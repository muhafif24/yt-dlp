import os
import threading
import traceback
from yt_dlp import YoutubeDL
from yt_dlp.utils import sanitize_filename
from utils import check_ffmpeg, format_size, format_duration

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
            if download_id in self.active_downloads and self.active_downloads[download_id].get("cancel_flag", False):
                # Lempar Exception untuk menghentikan unduhan di yt-dlp
                raise Exception("Download cancelled by user")

        status = data.get("status")
        
        payload = {
            "id": download_id,
            "status": status,
            "progress": 0,
            "speed": "0 B/s",
            "eta": "00:00",
            "downloaded": "0 B",
            "total": "0 B",
            "filename": os.path.basename(data.get("filename", ""))
        }

        if status == "downloading":
            downloaded = data.get("downloaded_bytes", 0)
            total = data.get("total_bytes") or data.get("total_bytes_estimate")
            speed = data.get("speed")
            eta = data.get("eta")

            if total:
                progress = int((downloaded / total) * 100)
                payload["progress"] = progress
                payload["total"] = format_size(total)
            
            payload["downloaded"] = format_size(downloaded)
            
            if speed:
                payload["speed"] = f"{format_size(speed)}/s"
            
            if eta:
                payload["eta"] = format_duration(eta)

        elif status == "finished":
            payload["progress"] = 100
            total = data.get("total_bytes", 0)
            payload["downloaded"] = format_size(total)
            payload["total"] = format_size(total)
            payload["speed"] = "Selesai"
            payload["eta"] = "00:00"

        # Kirim update ke frontend JS jika window terdaftar
        if self._window:
            # Gunakan string escaping yang aman
            js_code = f"if (window.updateDownloadProgress) {{ window.updateDownloadProgress({payload}); }}"
            self._window.evaluate_js(js_code)

    def _run_download(self, download_id, url, format_id, output_path):
        """
        Dijalankan di dalam thread terpisah.
        """
        ffmpeg_info = check_ffmpeg()
        
        # Konfigurasi parameter yt-dlp
        # Jika format_id = 'bestaudio', kita download audio saja dan convert ke mp3
        # Jika format_id = 'best', kita download video terbaik (biasanya merged)
        ydl_opts = {
            'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
            'progress_hooks': [lambda d: self._progress_hook(download_id, d)],
            'js_runtimes': {'node': {'path': None}}, # Memaksa penggunaan Node.js bawaan sistem
            'noplaylist': True,                      # Abaikan playlist saat pengunduhan video tunggal
        }

        # Tambahkan path FFmpeg jika tersedia
        if ffmpeg_info["available"]:
            # ffmpeg_location menerima path ke folder biner
            ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_info["ffmpeg_path"])
        
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

                # Jalankan unduhan sebenarnya
                ydl.download([url])

             # Informasikan frontend bahwa unduhan selesai penuh (termasuk post-processing)
            if self._window:
                sanitized_title = sanitize_filename(title)
                filename = f"{sanitized_title}.mp3" if format_id == "bestaudio" else f"{sanitized_title}.{ext}"
                safe_filename = filename.replace("'", "\\'")
                js_code = f"if (window.onDownloadComplete) {{ window.onDownloadComplete('{download_id}', '{safe_filename}'); }}"
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
                safe_friendly_err = friendly_err.replace("'", "\\'")
                js_code = f"if (window.onDownloadError) {{ window.onDownloadError('{download_id}', '{safe_friendly_err}'); }}"
                self._window.evaluate_js(js_code)

        finally:
            with self.lock:
                if download_id in self.active_downloads:
                    self.active_downloads[download_id]["running"] = False

    def start_download(self, download_id, url, format_id, output_path):
        """
        Memulai thread unduhan baru.
        """
        thread = threading.Thread(
            target=self._run_download,
            args=(download_id, url, format_id, output_path),
            daemon=True
        )
        
        with self.lock:
            self.active_downloads[download_id] = {
                "thread": thread,
                "status": "starting",
                "running": True,
                "cancel_flag": False,
                "url": url,
                "format_id": format_id,
                "title": "Mengambil info video..."
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
