import os
import sys
import threading

# Tambahkan direktori root proyek dan folder gui ke sys.path agar impor lokal dapat diselesaikan dengan benar
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)
sys.path.insert(0, os.path.dirname(current_dir))

import webview
import pystray
from PIL import Image
from api import Api
from utils import get_resource_path


def _load_tray_image(icon_path):
    """Load tray icon image, fallback to a plain violet square if not found."""
    try:
        img = Image.open(icon_path).convert("RGBA")
        img = img.resize((64, 64), Image.LANCZOS)
        return img
    except Exception:
        img = Image.new("RGBA", (64, 64), (124, 58, 237, 255))
        return img


def _create_tray(window, icon_path):
    """Build and return a pystray Icon instance (not yet running)."""
    image = _load_tray_image(icon_path)

    def on_show(icon, item):
        window.show()

    def on_quit(icon, item):
        icon.stop()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem("Show Fetchr", on_show, default=True),
        pystray.MenuItem("Quit", on_quit),
    )

    return pystray.Icon("fetchr", image, "Fetchr", menu)


def main():
    # Inisialisasi API bridge
    api = Api()

    # Mode pengembangan: set env var FETCHR_DEV=1 untuk memuat live dev server Vite (HMR)
    DEV_MODE = os.environ.get("FETCHR_DEV", "0") == "1"

    if DEV_MODE:
        url_target = "http://localhost:5175"
        print(f"Memuat antarmuka pengembangan (Vite HMR) dari: {url_target}")
    else:
        url_target = get_resource_path("gui/frontend/index.html")
        if not os.path.exists(url_target):
            print(f"Error: File HTML tidak ditemukan di {url_target}")
            url_target = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "index.html"))
            if not os.path.exists(url_target):
                sys.exit(f"Fatal Error: Antarmuka HTML tidak ditemukan di {url_target}!")
        print(f"Memuat antarmuka produksi statis dari: {url_target}")

    window = webview.create_window(
        title="Fetchr",
        url=url_target,
        js_api=api,
        width=1020,
        height=720,
        min_size=(800, 600),
        background_color='#080b11'
    )

    api.set_window(window)

    # Tutup tombol X → sembunyikan ke tray, bukan keluar
    def on_closing():
        window.hide()
        return False  # batalkan penutupan default

    window.events.closing += on_closing

    # Siapkan tray icon
    icon_path = get_resource_path("fetchr.ico")
    tray = _create_tray(window, icon_path)

    # Jalankan tray di thread terpisah agar tidak memblokir webview
    tray_thread = threading.Thread(target=tray.run, daemon=True)
    tray_thread.start()

    # Jalankan GUI loop (blocking sampai os._exit dipanggil dari tray)
    webview.start(debug=DEV_MODE)


if __name__ == "__main__":
    main()
