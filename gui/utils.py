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
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    return os.path.abspath(os.path.join(base_path, relative_path))

def get_bundled_bin_dir():
    """
    Mengembalikan path folder gui/bin yang berisi biner bawaan (ffmpeg, qjs, dll).
    Menangani mode frozen PyInstaller (--onedir) dan mode development.
    """
    if getattr(sys, 'frozen', False):
        # Frozen mode: cari relatif ke yt-dlp.exe (bukan _internal/)
        app_dir = os.path.dirname(sys.executable)
        bin_dir = os.path.join(app_dir, "gui", "bin")
        if not os.path.exists(bin_dir):
            bin_dir = os.path.join(app_dir, "bin")
            if not os.path.exists(bin_dir):
                # Fallback untuk mode onefile
                bin_dir = os.path.join(sys._MEIPASS, "gui", "bin")
    else:
        bin_dir = get_resource_path("gui/bin")
    return bin_dir

def check_ffmpeg():
    """
    Memeriksa keberadaan ffmpeg.exe dan ffprobe.exe.
    Mengecek di:
    1. Folder 'gui/bin' bawaan aplikasi
    2. PATH sistem
    Mengembalikan dict berisi status dan path-nya.
    """
    bin_dir = get_bundled_bin_dir()
    ffmpeg_internal = os.path.join(bin_dir, "ffmpeg.exe")
    ffprobe_internal = os.path.join(bin_dir, "ffprobe.exe")
    has_internal = os.path.exists(ffmpeg_internal) and os.path.exists(ffprobe_internal)

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
    Memeriksa ketersediaan JavaScript runtime untuk yt-dlp JS challenge solver.
    Urutan prioritas: QuickJS bundled > Deno (PATH) > Node.js (PATH) > QuickJS (PATH)
    Mengembalikan dict dengan 'runtime_key' yang sesuai dengan yt-dlp js_runtimes.
    """
    # 1. Cek QuickJS bawaan (gui/bin/qjs.exe) — paling diutamakan karena bundled
    bin_dir = get_bundled_bin_dir()
    qjs_internal = os.path.join(bin_dir, "qjs.exe")
    if os.path.exists(qjs_internal):
        return {
            "available": True,
            "name": "QuickJS (bundled)",
            "path": qjs_internal,
            "runtime_key": "quickjs"
        }

    # 2. Cek Deno di PATH sistem
    deno_path = shutil.which("deno")
    if deno_path:
        return {"available": True, "name": "Deno", "path": deno_path, "runtime_key": "deno"}

    # 3. Cek Node.js di PATH sistem
    node_path = shutil.which("node")
    if node_path:
        return {"available": True, "name": "Node.js", "path": node_path, "runtime_key": "node"}

    # 4. Cek QuickJS (qjs) di PATH sistem
    qjs_path = shutil.which("qjs")
    if qjs_path:
        return {"available": True, "name": "QuickJS", "path": qjs_path, "runtime_key": "quickjs"}

    return {"available": False, "name": None, "path": None, "runtime_key": None}

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
