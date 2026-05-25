import os
import sys
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
        "--clean",                              # Bersihkan cache sebelum build
        f"--workpath={os.path.join(base_dir, 'build')}",
        f"--distpath={os.path.join(base_dir, 'dist')}",
    ]
    
    # Eksekusi PyInstaller
    PyInstaller.__main__.run(args)
    print("Build PyInstaller selesai.")
    
    # Menyalin biner FFmpeg portabel (jika ada) ke folder hasil build
    bin_src = os.path.join(gui_dir, "bin")
    bin_dest = os.path.join(base_dir, "dist", "yt-dlp", "gui", "bin")
    
    if os.path.exists(bin_src):
        ffmpeg_file = os.path.join(bin_src, "ffmpeg.exe")
        ffprobe_file = os.path.join(bin_src, "ffprobe.exe")
        
        if os.path.exists(ffmpeg_file) and os.path.exists(ffprobe_file):
            print("Menyalin biner FFmpeg portabel ke direktori dist...")
            if not os.path.exists(bin_dest):
                os.makedirs(bin_dest)
            shutil.copy2(ffmpeg_file, os.path.join(bin_dest, "ffmpeg.exe"))
            shutil.copy2(ffprobe_file, os.path.join(bin_dest, "ffprobe.exe"))
            print("FFmpeg portabel berhasil disalin ke dist.")
        else:
            print("Peringatan: Biner ffmpeg.exe atau ffprobe.exe tidak ditemukan di gui/bin. Folder rilis tidak akan menyertakan FFmpeg.")
    else:
        print("Peringatan: Folder gui/bin tidak ditemukan. FFmpeg tidak disertakan.")

if __name__ == "__main__":
    build()
