import os
import sys
import shutil
import subprocess

def get_resource_path(relative_path):
    """
    Mendapatkan path absolute ke resource, menangani runtime biasa
    dan runtime yang sudah dipaketkan oleh PyInstaller.
    """
    try:
        # PyInstaller membuat folder sementara dan menyimpan path di _MEIPASS
        base_path = sys._MEIPASS
    except AttributeError:
        # Jika berjalan dalam mode development biasa, gunakan path dari folder ini
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    return os.path.abspath(os.path.join(base_path, relative_path))

def check_ffmpeg():
    """
    Memeriksa keberadaan ffmpeg.exe dan ffprobe.exe.
    Mengecek di:
    1. Folder 'bin' bawaan paket (terutama setelah dipaketkan)
    2. PATH sistem
    Mengembalikan dict berisi status dan path-nya.
    """
    # 1. Cek di folder biner internal aplikasi
    internal_bin_dir = get_resource_path("gui/bin")
    if not os.path.exists(internal_bin_dir):
        # Saat dipaketkan, folder 'gui/bin' mungkin diletakkan langsung di root folder dist
        internal_bin_dir = get_resource_path("bin")

    ffmpeg_internal = os.path.join(internal_bin_dir, "ffmpeg.exe")
    ffprobe_internal = os.path.join(internal_bin_dir, "ffprobe.exe")

    # Pastikan file internal ada dan executable
    has_internal = os.path.exists(ffmpeg_internal) and os.path.exists(ffprobe_internal)
    
    # 2. Cek di PATH sistem
    ffmpeg_system = shutil.which("ffmpeg")
    ffprobe_system = shutil.which("ffprobe")
    has_system = ffmpeg_system is not None and ffprobe_system is not None

    if has_internal:
        return {
            "available": True,
            "ffmpeg_path": ffmpeg_internal,
            "ffprobe_path": ffprobe_internal,
            "source": "internal"
        }
    elif has_system:
        return {
            "available": True,
            "ffmpeg_path": ffmpeg_system,
            "ffprobe_path": ffprobe_system,
            "source": "system"
        }
    
    return {
        "available": False,
        "ffmpeg_path": None,
        "ffprobe_path": None,
        "source": None
    }

def check_js_runtime():
    """
    Memeriksa ketersediaan Node.js atau Deno untuk penanganan signature decipher.
    """
    # Cek Deno
    deno_path = shutil.which("deno")
    if deno_path:
        return {"available": True, "name": "Deno", "path": deno_path}
    
    # Cek Node.js
    node_path = shutil.which("node")
    if node_path:
        return {"available": True, "name": "Node.js", "path": node_path}
    
    return {"available": False, "name": None, "path": None}

def format_size(bytes_size):
    """
    Memformat ukuran byte ke string yang mudah dibaca (KB, MB, GB).
    """
    if bytes_size is None:
        return "Unknown size"
    
    try:
        bytes_size = float(bytes_size)
    except (ValueError, TypeError):
        return "Unknown size"

    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} PB"

def format_duration(seconds):
    """
    Memformat detik ke string durasi HH:MM:SS atau MM:SS.
    """
    if seconds is None:
        return "Unknown duration"
    
    try:
        seconds = int(seconds)
    except (ValueError, TypeError):
        return "Unknown duration"

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"

def get_app_data_dir():
    """
    Mendapatkan path direktori AppData lokal pengguna untuk menyimpan data riwayat.
    """
    if sys.platform == 'win32':
        base_dir = os.environ.get('APPDATA', os.path.expanduser('~'))
    else:
        base_dir = os.path.expanduser('~')
        
    app_dir = os.path.join(base_dir, 'yt-dlp-gui')
    if not os.path.exists(app_dir):
        os.makedirs(app_dir)
        
    return app_dir
