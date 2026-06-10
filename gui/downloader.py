import os
import json
import threading
import traceback
from yt_dlp import YoutubeDL
from yt_dlp.utils import sanitize_filename
from utils import check_ffmpeg, check_js_runtime, format_size, format_duration

class DownloadManager:
    def __init__(self, window=None):
        self._window = window
        self.active_downloads = {}  # Format: {download_id: {thread, status, cancel_flag, ...}}
        self.lock = threading.Lock()

    def set_window(self, window):
        self._window = window

    def _progress_hook(self, download_id, data):
        """
        Progress hook yang dipanggil oleh yt-dlp.
        Mengirimkan status progres ke frontend secara real-time menggunakan evaluate_js.
        """
        with self.lock:
            if download_id not in self.active_downloads:
                return
            dl = self.active_downloads[download_id]
            if dl.get("cancel_flag", False):
                raise Exception("Download cancelled by user")

            status = data.get("status")
            # Setiap kali satu stream selesai ('finished'), naikkan nomor fase
            if status == "finished":
                dl["phase"] = dl.get("phase", 1) + 1
            phase = dl.get("phase", 1)

        payload = {
            "id": download_id,
            "status": status,
            "phase": phase,
            "progress": 0,
            "speed": "—",
            "eta": "—",
            "downloaded": "0 B",
            "total": "—",
            "filename": os.path.basename(data.get("filename", ""))
        }

        if status == "downloading":
            downloaded = data.get("downloaded_bytes", 0)
            total = data.get("total_bytes") or data.get("total_bytes_estimate")
            speed = data.get("speed")
            eta = data.get("eta")

            if total and total > 0:
                payload["progress"] = min(int((downloaded / total) * 100), 99)
                payload["total"] = format_size(total)

            payload["downloaded"] = format_size(downloaded)

            if speed:
                payload["speed"] = f"{format_size(speed)}/s"

            if eta:
                payload["eta"] = format_duration(eta)

        elif status == "finished":
            # Stream selesai — reset progress untuk fase berikutnya atau tunggu merge
            payload["progress"] = 0
            payload["speed"] = "—"
            payload["eta"] = "—"

        # Kirim update ke frontend JS jika window terdaftar
        if self._window:
            js_code = f"if (window.updateDownloadProgress) {{ window.updateDownloadProgress({json.dumps(payload)}); }}"
            self._window.evaluate_js(js_code)

    def _run_download(self, download_id, url, format_id, output_path, subtitle_lang=None, embed_subs=True):
        """
        Dijalankan di dalam thread terpisah.
        """
        ffmpeg_info = check_ffmpeg()
        js_info = check_js_runtime()

        ydl_opts = {
            'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            'progress_hooks': [lambda d: self._progress_hook(download_id, d)],
            'noplaylist': True,  # Abaikan playlist saat pengunduhan video tunggal
        }
        if js_info["available"]:
            ydl_opts['js_runtimes'] = {js_info["runtime_key"]: {'path': js_info["path"]}}

        # Tambahkan path FFmpeg jika tersedia
        if ffmpeg_info["available"]:
            # ffmpeg_location menerima path ke folder biner
            ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_info["ffmpeg_path"])
        
        # Subtitle options (only for video formats, not audio-only)
        if subtitle_lang and format_id != 'bestaudio':
            ydl_opts['writesubtitles'] = True
            ydl_opts['writeautomaticsub'] = True
            ydl_opts['subtitleslangs'] = [subtitle_lang]
            ydl_opts['subtitlesformat'] = 'srt/vtt/best'
            if embed_subs and ffmpeg_info["available"]:
                ydl_opts.setdefault('postprocessors', []).append(
                    {'key': 'FFmpegEmbedSubtitle', 'already_have_subtitle': False}
                )

        # Tentukan opsi format
        if format_id == "bestaudio":
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        elif format_id and format_id != "best":
            # format_id bisa berisi gabungan video+audio terbaik jika dipilih resolusi tertentu
            # yt-dlp mendukung format merger seperti 'f137+f251' untuk 1080p + audio
            ydl_opts['format'] = f"{format_id}+bestaudio/best"
        else:
            ydl_opts['format'] = 'bestvideo+bestaudio/best'

        try:
            with YoutubeDL(ydl_opts) as ydl:
                # Dapatkan metadata video sebelum unduhan untuk melacak judul akhir
                info = ydl.extract_info(url, download=False)
                title = info.get("title", "Video")
                ext = info.get("ext", "mp4")
                
                # Perbarui detail di active_downloads
                with self.lock:
                    if download_id in self.active_downloads:
                        self.active_downloads[download_id]["title"] = title

                # Informasikan frontend judul video sudah diketahui
                if self._window:
                    js_code = f"if (window.onDownloadStarted) {{ window.onDownloadStarted({json.dumps(download_id)}, {json.dumps(title)}); }}"
                    self._window.evaluate_js(js_code)

                # Jalankan unduhan sebenarnya
                ydl.download([url])

            # Informasikan frontend bahwa unduhan selesai penuh (termasuk post-processing)
            if self._window:
                sanitized_title = sanitize_filename(title)
                filename = f"{sanitized_title}.mp3" if format_id == "bestaudio" else f"{sanitized_title}.{ext}"
                js_code = f"if (window.onDownloadComplete) {{ window.onDownloadComplete({json.dumps(download_id)}, {json.dumps(filename)}); }}"
                self._window.evaluate_js(js_code)

        except Exception as e:
            error_msg = str(e)
            if "cancelled" in error_msg.lower():
                status = "cancelled"
                friendly_err = "Unduhan dibatalkan oleh pengguna."
            else:
                status = "error"
                friendly_err = f"Gagal mengunduh: {error_msg}"
                traceback.print_exc()

            with self.lock:
                if download_id in self.active_downloads:
                    self.active_downloads[download_id]["status"] = status
                    self.active_downloads[download_id]["error"] = friendly_err

            if self._window:
                js_code = f"if (window.onDownloadError) {{ window.onDownloadError({json.dumps(download_id)}, {json.dumps(friendly_err)}); }}"
                self._window.evaluate_js(js_code)

        finally:
            with self.lock:
                if download_id in self.active_downloads:
                    self.active_downloads[download_id]["running"] = False

    def start_download(self, download_id, url, format_id, output_path, subtitle_lang=None, embed_subs=True):
        """
        Memulai thread unduhan baru.
        """
        thread = threading.Thread(
            target=self._run_download,
            args=(download_id, url, format_id, output_path, subtitle_lang, embed_subs),
            daemon=True
        )
        
        with self.lock:
            self.active_downloads[download_id] = {
                "thread": thread,
                "status": "starting",
                "running": True,
                "cancel_flag": False,
                "phase": 1,
                "url": url,
                "format_id": format_id,
                "title": "Fetching video info..."
            }
        
        thread.start()
        return True

    def cancel_download(self, download_id):
        """
        Menandai tugas unduhan untuk dibatalkan.
        """
        with self.lock:
            if download_id in self.active_downloads:
                self.active_downloads[download_id]["cancel_flag"] = True
                self.active_downloads[download_id]["status"] = "cancelling"
                return True
        return False

    def get_status(self, download_id):
        """
        Mengambil status unduhan tertentu.
        """
        with self.lock:
            if download_id in self.active_downloads:
                info = self.active_downloads[download_id]
                return {
                    "id": download_id,
                    "status": info["status"],
                    "running": info["running"],
                    "title": info["title"]
                }
        return None
