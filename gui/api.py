import os
import json
import uuid
import webview
from yt_dlp import YoutubeDL
from yt_dlp.utils import sanitize_filename
from utils import check_ffmpeg, check_js_runtime, get_app_data_dir, format_size, format_duration
from downloader import DownloadManager

class Api:
    def __init__(self):
        self._window = None
        self._downloader = DownloadManager()
        self._history_file = os.path.join(get_app_data_dir(), "history.json")
        self._ensure_history_exists()

    def set_window(self, window):
        self._window = window
        self._downloader.set_window(window)

    def _ensure_history_exists(self):
        if not os.path.exists(self._history_file):
            with open(self._history_file, 'w', encoding='utf-8') as f:
                json.dump([], f)

    # API Methods exposed to JavaScript:

    def check_system_status(self):
        """
        Memeriksa status dependensi sistem (FFmpeg dan JS runtime).
        """
        ffmpeg_status = check_ffmpeg()
        js_status = check_js_runtime()
        
        default_download_dir = os.path.join(os.path.expanduser('~'), 'Downloads')
        if not os.path.exists(default_download_dir):
            default_download_dir = os.path.expanduser('~')

        return {
            "ffmpeg": {
                "available": ffmpeg_status["available"],
                "source": ffmpeg_status["source"],
                "ffmpeg_path": ffmpeg_status["ffmpeg_path"]
            },
            "js_runtime": {
                "available": js_status["available"],
                "name": js_status["name"],
                "path": js_status["path"]
            },
            "default_dir": default_download_dir
        }

    def select_folder(self):
        """
        Membuka dialog pemilihan folder sistem native Windows.
        """
        if not self._window:
            return None
        
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result and len(result) > 0:
            return result[0]
        return None

    def get_video_info(self, url):
        """
        Mengekstrak metadata video (judul, thumbnail, format yang tersedia).
        """
        if not url:
            return {"success": False, "error": "URL tidak boleh kosong."}

        # Cek status dependensi
        ffmpeg_info = check_ffmpeg()

        ydl_opts = {
            'js_runtimes': {'node': {'path': None}}, # Memaksa penggunaan Node.js
            'noplaylist': True,                      # Abaikan playlist untuk kecepatan analisis video tunggal
        }
        if ffmpeg_info["available"]:
            ydl_opts['ffmpeg_location'] = os.path.dirname(ffmpeg_info["ffmpeg_path"])

        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Saring format yang berguna (video dengan audio, video saja, audio saja)
                formats = []
                
                # Masukkan opsi default "Terbaik (Otomatis)"
                formats.append({
                    "id": "best",
                    "label": "Kualitas Terbaik (Otomatis)",
                    "ext": "mp4 / mkv",
                    "size": "Otomatis"
                })

                # Opsi audio saja
                formats.append({
                    "id": "bestaudio",
                    "label": "Hanya Audio (MP3 192kbps)",
                    "ext": "mp3",
                    "size": "Bervariasi"
                })

                # Parsing format video yang tersedia dari yt-dlp
                raw_formats = info.get("formats", [])
                
                # Kita saring beberapa opsi resolusi populer (1080p, 720p, 480p, 360p)
                seen_heights = set()
                # Sortir format berdasarkan tinggi resolusi menurun
                sorted_formats = sorted(
                    [f for f in raw_formats if f.get('height') and f.get('vcodec') != 'none'],
                    key=lambda x: x.get('height', 0),
                    reverse=True
                )

                for f in sorted_formats:
                    height = f.get('height')
                    # Kita hanya ambil satu entri terbaik untuk setiap resolusi standar
                    if height in [1080, 720, 480, 360]:
                        if height not in seen_heights:
                            seen_heights.add(height)
                            
                            # Cek estimasi ukuran file
                            filesize = f.get('filesize') or f.get('filesize_approx')
                            size_str = format_size(filesize) if filesize else "Estimasi tidak tersedia"
                            
                            formats.append({
                                "id": f.get('format_id'),
                                "label": f"{height}p HD (Video + Audio)",
                                "ext": f.get('ext', 'mp4'),
                                "size": size_str
                            })

                return {
                    "success": True,
                    "title": info.get("title", "Video Tanpa Judul"),
                    "thumbnail": info.get("thumbnail", ""),
                    "duration": format_duration(info.get("duration", 0)),
                    "uploader": info.get("uploader", "Unknown"),
                    "formats": formats
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def start_download(self, url, format_id, output_path):
        """
        Memulai proses pengunduhan.
        """
        if not url or not output_path:
            return {"success": False, "error": "Parameter tidak lengkap."}

        if not os.path.exists(output_path):
            try:
                os.makedirs(output_path)
            except Exception as e:
                return {"success": False, "error": f"Gagal membuat folder output: {str(e)}"}

        download_id = str(uuid.uuid4())
        
        # Mulai pengunduhan asinkron
        success = self._downloader.start_download(download_id, url, format_id, output_path)
        
        if success:
            return {"success": True, "download_id": download_id}
        else:
            return {"success": False, "error": "Gagal memulai tugas pengunduhan."}

    def cancel_download(self, download_id):
        """
        Membatalkan pengunduhan berjalan.
        """
        success = self._downloader.cancel_download(download_id)
        return {"success": success}

    def get_download_history(self):
        """
        Mengambil riwayat unduhan dari history.json.
        """
        try:
            with open(self._history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def add_to_history(self, title, url, format_label, output_dir, filename):
        """
        Menambahkan item ke berkas riwayat JSON.
        """
        try:
            history = self.get_download_history()
            
            # Format item riwayat baru
            import datetime
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            new_item = {
                "title": title,
                "url": url,
                "format": format_label,
                "date": now,
                "folder": output_dir,
                "filename": filename
            }
            
            # Batasi riwayat hanya sampai 50 item terakhir agar tidak membengkak
            history.insert(0, new_item)
            history = history[:50]
            
            with open(self._history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=4, ensure_ascii=False)
                
            return True
        except Exception as e:
            print(f"Gagal menyimpan riwayat: {e}")
            return False

    def delete_history_item(self, index, delete_file):
        """
        Menghapus item riwayat berdasarkan indeksnya.
        Jika delete_file = True, hapus juga file video fisiknya dari disk.
        """
        try:
            history = self.get_download_history()
            if index < 0 or index >= len(history):
                return {"success": False, "error": "Indeks tidak valid."}
                
            item = history[index]
            
            # Jika diminta menghapus berkas fisik
            if delete_file:
                folder = item.get("folder")
                filename = item.get("filename")
                if folder and filename:
                    file_path = os.path.join(folder, filename)
                    # Fallback ke pencarian wildcard jika file dengan ekstensi asli tidak ada
                    if not os.path.exists(file_path):
                        import glob
                        base_name, _ = os.path.splitext(filename)
                        sanitized_base = sanitize_filename(base_name)
                        patterns = [
                            os.path.join(folder, f"{base_name}.*"),
                            os.path.join(folder, f"{sanitized_base}.*")
                        ]
                        for pattern in patterns:
                            matches = glob.glob(pattern)
                            valid_matches = [m for m in matches if not m.endswith('.part') and not m.endswith('.ytdl')]
                            if valid_matches:
                                file_path = valid_matches[0]
                                break
                                
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            # Catat saja jika gagal menghapus file (misal karena terkunci)
                            print(f"Gagal menghapus file fisik: {e}")
                            
            # Hapus dari list riwayat
            history.pop(index)
            
            # Simpan kembali ke JSON
            with open(self._history_file, 'w', encoding='utf-8') as f:
                json.dump(history, f, indent=4, ensure_ascii=False)
                
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_folder(self, folder_path):
        """
        Membuka folder penyimpanan di File Explorer Windows.
        """
        if not folder_path or not os.path.exists(folder_path):
            return {"success": False, "error": "Folder tidak ditemukan."}
        
        try:
            os.startfile(os.path.normpath(folder_path))
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def play_video(self, folder_path, filename):
        """
        Memutar video hasil unduhan menggunakan pemutar media default Windows.
        """
        if not folder_path or not filename:
            return {"success": False, "error": "Parameter tidak lengkap."}
            
        # Pengecekan path asli langsung
        file_path = os.path.join(folder_path, filename)
        
        if not os.path.exists(file_path):
            # Coba cari nama berkas yang disanitasi
            sanitized_name = sanitize_filename(filename)
            file_path = os.path.join(folder_path, sanitized_name)
            
        # Jika masih belum ditemukan (misal karena perbedaan ekstensi pasca-merging oleh FFmpeg),
        # kita lakukan pencarian berbasis wildcard (glob) pada nama basis berkas
        if not os.path.exists(file_path):
            import glob
            
            # Ambil nama basis tanpa ekstensi
            base_name, _ = os.path.splitext(filename)
            sanitized_base = sanitize_filename(base_name)
            
            # Pola pencarian wildcard
            patterns = [
                os.path.join(folder_path, f"{base_name}.*"),
                os.path.join(folder_path, f"{sanitized_base}.*")
            ]
            
            found = False
            for pattern in patterns:
                matches = glob.glob(pattern)
                # Filter agar tidak mencocokkan file part temporer yt-dlp (.part, .ytdl)
                valid_matches = [m for m in matches if not m.endswith('.part') and not m.endswith('.ytdl')]
                if valid_matches:
                    file_path = valid_matches[0]
                    found = True
                    break
                    
            if not found:
                return {"success": False, "error": "File video tidak ditemukan."}
            
        try:
            os.startfile(os.path.normpath(file_path))
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
