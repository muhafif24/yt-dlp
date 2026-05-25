# Ringkasan Diskusi Dependensi & Eksekusi yt-dlp

Dokumen ini mencatat detail diskusi kita mengenai kesiapan eksekusi proyek `yt-dlp` langsung di sistem lokal pada tanggal 25 Mei 2026.

---

## 🔍 Detail Diskusi & Analisis

### 1. Masalah Runtime JavaScript (JS Runtime) untuk YouTube
*   **Temuan:** Saat menjalankan `yt-dlp` pertama kali untuk mengunduh video YouTube, muncul peringatan bahwa tidak ada JS runtime yang didukung (defaultnya adalah Deno). YouTube memerlukan JS runtime untuk memecahkan tanda tangan pemutar video.
*   **Analisis Sistem:** 
    *   Deno belum terpasang di sistem.
    *   Namun, **Node.js (v22.17.0)** terdeteksi terpasang pada sistem Anda.
*   **Solusi yang Disepakati/Diusulkan:** Kita dapat memaksa `yt-dlp` menggunakan Node.js dengan menambahkan argumen `--js-runtimes node`. Kami telah menguji perintah berikut dan berjalan dengan sukses tanpa peringatan:
    ```powershell
    python -m yt_dlp --js-runtimes node -v
    ```
*   **Rencana Konfigurasi Permanen:** Membuat file konfigurasi lokal `yt-dlp.conf` di root folder proyek yang berisi `--js-runtimes node` agar Anda tidak perlu mengetikkan opsi tersebut setiap kali menjalankan perintah.

### 2. Masalah FFmpeg (Kualitas Unduhan Video)
*   **Temuan:** Sistem memunculkan peringatan *`WARNING: ffmpeg not found. The downloaded format may not be the best available.`* Karena tidak ada FFmpeg, yt-dlp terpaksa mengunduh format MP4 360p (format 18) yang merupakan satu-satunya format yang disatukan langsung oleh YouTube dalam resolusi rendah.
*   **Pentingnya FFmpeg:** Diperlukan agar `yt-dlp` bisa mengunduh trek video HD (1080p, 4K) dan trek audio resolusi tinggi secara terpisah, lalu menggabungkannya (*merge*) menjadi satu file video utuh.
*   **Solusi yang Diusulkan:** Menginstal FFmpeg menggunakan **`winget`** (Windows Package Manager) yang terpasang di sistem Anda dengan perintah:
    ```powershell
    winget install Gyan.FFmpeg
    ```

---

## 📋 Langkah Kerja yang Direkomendasikan Selanjutnya

1.  **Membuat File Konfigurasi Lokal (`yt-dlp.conf`):**
    Menambahkan parameter `--js-runtimes node` agar Node.js digunakan secara otomatis.
2.  **Menginstal FFmpeg:**
    Melakukan eksekusi perintah `winget install Gyan.FFmpeg` untuk mendapatkan kualitas video HD.
3.  **Pengujian Unduhan:**
    Mengulangi unduhan video YouTube untuk memastikan resolusi terbaik (misalnya 1080p) berhasil diunduh dan digabungkan dengan audio secara otomatis.
