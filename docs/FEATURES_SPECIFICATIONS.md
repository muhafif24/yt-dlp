# Features & Specifications - yt-dlp

Dokumen ini mendokumentasikan spesifikasi fitur utama dan kemampuan teknis dari `yt-dlp`.

---

## 🌟 Fitur Utama (Core Features)

### 1. Pengunduhan Multi-Situs (Multi-Site Downloader)
*   Mendukung ribuan situs berbagi video dan audio (termasuk YouTube, Vimeo, TikTok, Twitch, dll).
*   Sistem ekstrator modular yang dapat disesuaikan untuk masing-masing platform.

### 2. Pemilihan Format Tingkat Lanjut (Advanced Format Selection)
*   Kemampuan menyortir dan memilih format berdasarkan kriteria tertentu (resolusi, bit-rate, codec video/audio, ukuran file, bahasa).
*   Mendukung penggabungan otomatis format video terbaik (tanpa suara) dan audio terbaik (tanpa video) menggunakan FFmpeg.

### 3. Penyamaran Permintaan (Client Impersonation)
*   Menggunakan pustaka `curl_cffi` untuk meniru sidik jari TLS (*TLS fingerprint*) dari browser populer seperti Chrome, Edge, dan Safari.
*   Berguna untuk melewati pembatasan akses (*rate-limiting* atau *anti-bot*) dari situs-situs yang melarang agen pengunduh non-browser.

### 4. Integrasi SponsorBlock
*   Mendukung penandaan (*marking*) atau penghapusan (*removing*) segmen video tertentu (sponsor, intro, outro, self-promotion, dll) menggunakan SponsorBlock API.

### 5. Ekstraksi Cookie Browser
*   Mendukung ekstraksi cookie langsung dari browser yang terpasang di sistem (Chrome, Firefox, Edge, Opera, Safari, dll) dengan opsi `--cookies-from-browser` untuk mengakses konten yang memerlukan autentikasi login.

### 6. Pemrosesan Pasca-Unduh (Post-Processing)
*   Konversi format video ke audio (misalnya MP4 ke MP3/AAC).
*   Penyematan gambar mini (*thumbnail*) ke dalam file unduhan menggunakan `mutagen` atau `AtomicParsley`.
*   Penulisan subtitle, metadata, bab (*chapters*), dan deskripsi video.

---

## ⚙️ Persyaratan Sistem & Dependensi Fitur

| Fitur | Dependensi yang Dibutuhkan | Status Sistem Saat Ini |
| :--- | :--- | :--- |
| Pengunduhan Video Dasar | Python 3.10+ | **Terpenuhi** (Python 3.13.9) |
| Penggabungan Format HD | FFmpeg & FFprobe (binary) | *Belum Terpasang* |
| Ekstraksi YouTube Lengkap | JS Runtime (Deno/Node.js) | **Terpenuhi** via Node.js v22.17.0 |
| TLS Impersonation | `curl_cffi` (Python library) | *Dapat diinstal via pip* |
| Penyematan Thumbnail | `mutagen` / `AtomicParsley` | *Dapat diinstal via pip* |
| Dekripsi HLS AES-128 | `pycryptodomex` | *Dapat diinstal via pip* |
