# Analisis Masalah: FFmpeg Not Found Pasca Instalasi

Dokumen ini mendokumentasikan penyebab masalah di mana status dependensi FFmpeg terdeteksi sebagai **"Not Found"** (tidak ditemukan) setelah aplikasi dipaketkan dan diinstal menggunakan Installer, serta menyajikan solusi perbaikan kodenya.

---

## 🔍 Deskripsi Masalah
Setelah aplikasi dipasang menggunakan file installer tunggal (`yt-dlp-setup.exe`) dan dijalankan di komputer pengguna, indikator dependensi di pojok kanan atas menunjukkan:
*   **FFmpeg: Not Found** (berwarna merah)
*   *Catatan:* Pilihan format kualitas video HD (seperti 1080p) tetap muncul tetapi penggabungan format video/audio akan gagal saat unduhan selesai karena FFmpeg portabel dianggap tidak tersedia oleh aplikasi.

---

## ⚙️ Penyebab Masalah (Root Cause)

Masalah ini disebabkan oleh perbedaan struktur direktori pemaketan **PyInstaller 6** (mode `--onedir`) dan cara deteksi path di fungsi `check_ffmpeg()` di berkas `gui/utils.py`.

### 1. Struktur PyInstaller 6 (`--onedir`)
Pada PyInstaller versi 6 ke atas, jika pemaketan menggunakan mode `--onedir` (one-directory), seluruh berkas modul Python dan file data tambahan yang didefinisikan di opsi `--add-data` diletakkan di dalam subfolder bernama **`_internal/`** di dalam folder distribusi. 

Variabel lingkungan runtime PyInstaller **`sys._MEIPASS`** secara otomatis akan mengarah ke direktori `_internal/` ini (misal: `C:\Program Files\yt-dlp\_internal\`).

### 2. Alur Penyalinan FFmpeg vs Lokasi Pencarian
*   **Penyalinan:** Script `gui/build_gui.py` menyalin biner FFmpeg portabel (`ffmpeg.exe` & `ffprobe.exe`) langsung ke root direktori rilis:
    `dist/yt-dlp/gui/bin/` (setara dengan `{app}\gui\bin\ffmpeg.exe` pasca instalasi, berada **di luar** folder `_internal`).
*   **Pencarian:** Di berkas `gui/utils.py`, fungsi `check_ffmpeg()` mencari biner tersebut menggunakan fungsi `get_resource_path("gui/bin")`, yang diimplementasikan dengan menggabungkan `sys._MEIPASS` dan path relatif.
    Sehingga aplikasi mencari FFmpeg di:
    `{app}\_internal\gui\bin\`
*   **Hasil:** Karena FFmpeg berada di `{app}\gui\bin\` (di luar `_internal`), aplikasi gagal menemukan berkas executable tersebut dan mengembalikan status `Not Found`.

---

## 🛠️ Solusi Perbaikan Kode

Untuk menyelesaikan masalah ini, fungsi `check_ffmpeg` di dalam berkas [gui/utils.py](file:///d:/Documents/Belajar/APP/AI/yt-dlp/gui/utils.py) harus diubah agar ia mendeteksi folder instalasi secara dinamis menggunakan **`sys.executable`** (jalur absolut berkas biner `yt-dlp.exe` yang sedang berjalan) alih-alih `sys._MEIPASS` jika aplikasi berjalan dalam mode paket (*frozen*).

### Perubahan Kode pada [gui/utils.py](file:///d:/Documents/Belajar/APP/AI/yt-dlp/gui/utils.py):

#### Kode Lama (Baris 28-36):
```python
    # 1. Cek di folder biner internal aplikasi
    internal_bin_dir = get_resource_path("gui/bin")
    if not os.path.exists(internal_bin_dir):
        # Saat dipaketkan, folder 'gui/bin' mungkin diletakkan langsung di root folder dist
        internal_bin_dir = get_resource_path("bin")
```

#### Kode Baru yang Direkomendasikan:
```python
    # 1. Tentukan folder biner internal aplikasi
    if getattr(sys, 'frozen', False):
        # Di mode frozen PyInstaller, cari relatif terhadap executable utama (yt-dlp.exe)
        app_dir = os.path.dirname(sys.executable)
        internal_bin_dir = os.path.join(app_dir, "gui", "bin")
        if not os.path.exists(internal_bin_dir):
            internal_bin_dir = os.path.join(app_dir, "bin")
            if not os.path.exists(internal_bin_dir):
                # Fallback ke folder _MEIPASS (jika menggunakan mode onefile)
                internal_bin_dir = os.path.join(sys._MEIPASS, "gui", "bin")
    else:
        # Di mode development biasa
        internal_bin_dir = get_resource_path("gui/bin")
```

---

## 🚀 Langkah Penyelesaian (Nanti)
Apabila Anda siap memperbaiki masalah ini, langkah yang harus dilakukan adalah:
1.  Buka berkas [gui/utils.py](file:///d:/Documents/Belajar/APP/AI/yt-dlp/gui/utils.py) dan ganti bagian pendeteksian `internal_bin_dir` dengan kode baru di atas.
2.  Buka terminal, aktifkan virtual environment (`.venv\Scripts\activate`), dan jalankan build PyInstaller kembali:
    `python gui/build_gui.py`
3.  Jalankan kembali kompilasi installer:
    `& "C:\Users\ASUS\AppData\Local\Programs\Inno Setup 6\ISCC.exe" gui\installer.iss`
4.  Instal ulang aplikasi menggunakan setup installer terbaru yang dihasilkan di folder `dist/`.
