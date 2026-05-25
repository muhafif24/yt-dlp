# Technical Stack - yt-dlp

Dokumen ini menjelaskan secara mendalam tumpukan teknologi, pustaka, alat bantu, serta dependensi yang digunakan dalam proyek `yt-dlp`.

---

## 🐍 Bahasa Pemrograman & Runtime
*   **Python:** Mendukung Python versi 3.10+ (CPython) dan 3.11+ (PyPy).
    *   *Status Sistem Saat Ini:* Python 3.13.9 (CPython AMD64 64-bit) terpasang secara global.
*   **JavaScript Engine (JS Runtime):** Diperlukan untuk mengeksekusi modul `yt-dlp-ejs` guna memecahkan kode tanda tangan (*signature decipher*) pada pemutar YouTube.
    *   *Runtime yang Didukung:* Deno (direkomendasikan & diaktifkan secara default), Node.js, Bun, QuickJS.
    *   *Status Sistem Saat Ini:* Node.js v22.17.0 terpasang secara global. Deno belum terpasang.

---

## 📦 Build & Environment Tools
*   **Hatch / Hatchling:** Digunakan sebagai sistem build standar untuk mendistribusikan paket python `yt-dlp` (sdist, wheel).
*   **uv:** Pengelola paket Python berkecepatan tinggi yang dikonfigurasi pada proyek untuk mengelola lingkungan pengembangan virtual (`.venv`).
*   **PyInstaller:** Digunakan untuk memaketkan seluruh kode Python beserta dependensinya menjadi satu file eksekutabel mandiri (`yt-dlp.exe` di Windows).

---

## 🎨 Linter & Formatter
Proyek ini dikonfigurasi menggunakan aturan pemformatan kode yang ketat untuk menjaga konsistensi:
*   **Ruff:** Linter Python yang super cepat, menggantikan beberapa linter tradisional. Panjang baris diatur maksimal 120 karakter.
*   **autopep8:** Pemformat kode otomatis sesuai dengan aturan PEP 8 yang dikonfigurasi di `pyproject.toml`.

---

## 📦 Dependensi Pihak Ketiga (Libraries & Binaries)

### Dependensi Biner Eksternal (Sangat Direkomendasikan)
*   **FFmpeg & FFprobe:** Alat baris perintah untuk memproses file audio/video.
    *   *Fungsi:* Menggabungkan trek video dan audio terpisah, konversi format, ekstraksi audio, dan penulisan metadata/thumbnail.
    *   *Status Sistem Saat Ini:* Belum terpasang.

### Dependensi Pustaka Python (Optional/Default)
*   **certifi:** Menyediakan bundel sertifikat root Mozilla untuk koneksi HTTPS yang aman.
*   **brotli / brotlicffi:** Mendukung kompresi konten Brotli untuk transfer data lebih cepat.
*   **websockets:** Digunakan untuk melakukan koneksi dan unduhan melalui protokol WebSocket.
*   **requests & urllib3:** Pustaka HTTP untuk mendukung HTTPS proxy, koneksi persisten, dan pengiriman permintaan web.
*   **curl_cffi:** Pustaka penyamaran sidik jari TLS (*impersonation*) untuk Chrome, Edge, dan Safari guna melewati proteksi bot/WAF pada situs tertentu.
*   **mutagen:** Untuk menyematkan gambar pratinjau (*thumbnail*) langsung ke dalam file audio/video.
*   **pycryptodomex:** Pustaka kriptografi untuk mendekripsi aliran HLS AES-128 dan data terenkripsi lainnya.
