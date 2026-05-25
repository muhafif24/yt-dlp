import os
import sys

# Tambahkan direktori root proyek dan folder gui ke sys.path agar impor lokal dapat diselesaikan dengan benar
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)
sys.path.insert(0, os.path.dirname(current_dir))

import webview
from api import Api
from utils import get_resource_path

def on_closed():
    """
    Callback saat jendela aplikasi ditutup.
    Mematikan proses latar belakang secara paksa jika ada unduhan aktif.
    """
    print("Aplikasi ditutup. Menghentikan semua proses...")
    # Paksa keluar untuk menghentikan daemon thread downloader
    os._exit(0)

def main():
    # Inisialisasi API bridge
    api = Api()
    
    # Mode pengembangan: Set True untuk memuat live dev server Vite (HMR)
    # Set False saat membangun versi rilis production
    DEV_MODE = False
    
    if DEV_MODE:
        url_target = "http://localhost:5173"
        print(f"Memuat antarmuka pengembangan (Vite HMR) dari: {url_target}")
    else:
        # Path ke file HTML frontend hasil build
        url_target = get_resource_path("gui/frontend/index.html")
        
        # Verifikasi file HTML ada
        if not os.path.exists(url_target):
            print(f"Error: File HTML tidak ditemukan di {url_target}")
            # Gunakan fallback jika dijalankan langsung dari folder gui/
            url_target = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "index.html"))
            if not os.path.exists(url_target):
                sys.exit(f"Fatal Error: Antarmuka HTML tidak ditemukan di {url_target}!")
        print(f"Memuat antarmuka produksi statis dari: {url_target}")

    # Buat jendela PyWebview
    # Lebar: 1020, Tinggi: 720, tidak bisa di-resize di bawah batas minimum agar UI tetap rapi
    window = webview.create_window(
        title="yt-dlp GUI",
        url=url_target,
        js_api=api,
        width=1020,
        height=720,
        min_size=(800, 600),
        background_color='#080b11'
    )
    
    # Hubungkan window ke API agar API bisa memicu evaluate_js
    api.set_window(window)
    
    # Daftarkan callback penutupan
    window.events.closed += on_closed

    # Jalankan GUI loop (menggunakan engine rendering Chromium Edge WebView2 di Windows)
    # debug=True memungkinkan inspeksi elemen (klik kanan -> inspect) saat masa pengembangan
    webview.start(debug=True)

if __name__ == "__main__":
    main()
