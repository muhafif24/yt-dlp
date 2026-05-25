import os
import shutil
import PyInstaller.__main__

def build():
    print("Memulai proses build PyInstaller...")
    
    # Path dasar proyek
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    gui_dir = os.path.join(base_dir, "gui")
    
    # Path frontend dan output
    frontend_src = os.path.join(gui_dir, "frontend")
    
    # Cek ketersediaan frontend
    if not os.path.exists(frontend_src):
        print(f"Error: Folder frontend tidak ditemukan di {frontend_src}!")
        return

    # Menentukan format pemisahan path data tambahan untuk PyInstaller (Windows menggunakan ';')
    separator = ";"
    
    # Argumen untuk PyInstaller
    args = [
        os.path.join(gui_dir, "app.py"),         # Entry point script
        "--onedir",                             # Mode folder (one-directory)
        "--noconsole",                          # Jangan tampilkan window hitam console
        f"--name=yt-dlp",                       # Nama produk
        f"--paths={base_dir}",                  # Tambahkan path root proyek agar modul lokal yt_dlp ditemukan
        f"--add-data={frontend_src}{separator}gui/frontend", # Sertakan folder frontend
        f"--icon={os.path.join(base_dir, 'fetchr.ico')}",   # Icon aplikasi
        "--hidden-import=pystray._win32",       # Backend pystray Windows
        "--hidden-import=PIL._tkinter_finder",  # Pillow
        "--clean",                              # Bersihkan cache sebelum build
        "--noconfirm",                          # Timpa folder dist tanpa konfirmasi
        f"--workpath={os.path.join(base_dir, 'build')}",
        f"--distpath={os.path.join(base_dir, 'dist')}",
    ]
    
    # Eksekusi PyInstaller
    PyInstaller.__main__.run(args)
    print("Build PyInstaller selesai.")
    
    # Menyalin semua biner dari gui/bin ke folder hasil build
    # (ffmpeg.exe, ffprobe.exe, qjs.exe, dst — semua .exe di folder bin)
    bin_src = os.path.join(gui_dir, "bin")
    bin_dest = os.path.join(base_dir, "dist", "yt-dlp", "gui", "bin")

    if os.path.exists(bin_src):
        exe_files = [f for f in os.listdir(bin_src) if f.lower().endswith(".exe")]
        if exe_files:
            if not os.path.exists(bin_dest):
                os.makedirs(bin_dest)
            for exe in exe_files:
                shutil.copy2(os.path.join(bin_src, exe), os.path.join(bin_dest, exe))
                print(f"  Disalin: {exe}")
            print(f"Semua biner dari gui/bin ({len(exe_files)} file) berhasil disalin ke dist.")
        else:
            print("Peringatan: Tidak ada file .exe di gui/bin.")
    else:
        print("Peringatan: Folder gui/bin tidak ditemukan. Biner tidak disertakan.")

if __name__ == "__main__":
    build()
