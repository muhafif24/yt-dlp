# yt-dlp - Master State

Dokumen ini adalah *Single Source of Truth* (Satu Sumber Kebenaran) yang mencatat status proyek saat ini, tumpukan teknologi, log keputusan, serta langkah berikutnya untuk fork `yt-dlp` ini.

---

## 📌 Ringkasan Proyek & Status Saat Ini
*   **Nama Proyek:** yt-dlp (Fork)
*   **Repositori Asal:** `https://github.com/yt-dlp/yt-dlp`
*   **Repositori Fork:** `https://github.com/muhafif24/yt-dlp`
*   **Direktori Kerja:** `d:\Documents\Belajar\APP\AI\yt-dlp`
*   **Status Terakhir:** Repositori berhasil dikloning ke root folder proyek. Berhasil melakukan pengujian awal menjalankan `yt-dlp` menggunakan interpreter Python sistem.

---

## 🛠️ Tumpukan Teknologi & Arsitektur
*   **Bahasa Utama:** Python 3.10+ (Sistem saat ini menggunakan Python 3.13.9)
*   **Build System:** Hatch / Hatchling
*   **Package Manager:** uv / pip
*   **Linter & Formatter:** Ruff, autopep8
*   **Dependensi Opsional Utama:**
    *   **FFmpeg & FFprobe:** Diperlukan untuk penggabungan (*merging*) video/audio kualitas tinggi serta *post-processing*. (Saat ini belum terinstal di sistem).
    *   **JS Runtime:** Diperlukan untuk penanganan JavaScript tanda tangan YouTube (`yt-dlp-ejs`). Deno diaktifkan secara default. (Node.js v22.17.0 terinstal di sistem, tetapi Deno belum ada).

---

## 📝 Log Keputusan Besar

### [25 Mei 2026] - Inisialisasi Proyek & Audit Dependensi
*   **Keputusan:** 
    1. Melakukan kloning repositori fork `muhafif24/yt-dlp` langsung ke root folder kerja `d:\Documents\Belajar\APP\AI\yt-dlp`.
    2. Menjalankan audit awal dependensi. Ditemukan bahwa proyek dapat berjalan langsung menggunakan Python 3.13.9 bawaan sistem.
    3. Mengidentifikasi masalah tidak adanya FFmpeg (menyebabkan video terunduh dalam kualitas rendah/360p) dan Deno (sebagai default JS runtime).
    4. Menemukan bahwa Node.js (v22.17.0) sudah terinstal dan bisa digunakan sebagai pengganti Deno dengan menambahkan argumen `--js-runtimes node`.

---

## 🚀 Langkah Selanjutnya (Upcoming Tasks)
1.  **Konfigurasi JS Runtime:** Membuat file konfigurasi lokal `yt-dlp.conf` berisi `--js-runtimes node` agar otomatis mendeteksi Node.js yang sudah terpasang.
2.  **Instalasi FFmpeg:** Menginstal FFmpeg via `winget` (`winget install Gyan.FFmpeg`) agar dapat mengunduh video kualitas tinggi (1080p, 4K) dan melakukan penggabungan audio-video.
3.  **Pembuatan Lingkungan Virtual (Virtual Environment):** Menyiapkan `.venv` lokal untuk menginstal dependensi Python tambahan (`mutagen`, `requests`, dll) guna mengaktifkan fitur-fitur lanjutan.
