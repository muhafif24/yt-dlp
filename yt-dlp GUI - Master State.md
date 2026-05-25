# yt-dlp GUI - Master State

Dokumen ini adalah acuan utama status proyek, tumpukan teknologi, keputusan arsitektur, dan langkah pengembangan aplikasi desktop yt-dlp GUI.

## 📋 Ringkasan Proyek & Status Saat Ini
Aplikasi pembungkus GUI desktop (Desktop Downloader) untuk `yt-dlp` menggunakan Python launcher (**PyWebview**) yang memuat antarmuka web modern berbasis **React (Vite) + Tailwind CSS + Shadcn UI**.
*   **Status saat ini:** Pengalihan antarmuka ke React selesai, namun terdapat bug visual pada layout select dropdown (Radix UI) di dalam WebView2. Kami sedang mengganti dropdown tersebut dengan select native yang dipercantik menggunakan Tailwind CSS agar stabil 100%.

## 🛠️ Tumpukan Teknologi & Arsitektur
*   **Launcher & Window:** PyWebview (Python) membungkus runtime Microsoft Edge WebView2.
*   **Backend:** Python 3.10+ (dengan thread unduhan non-blocking, utilitas sanitasi berkas Windows, integrasi API sistem, dan pengelola riwayat format JSON).
*   **Engine Unduhan:** `yt-dlp` core yang secara dinamis menggunakan FFmpeg lokal (`gui/bin/`) untuk post-processing / merge video & audio.
*   **Frontend:** React 18 (Vite) + TypeScript + Tailwind CSS (v4) + Shadcn UI.
*   **Bridging API:** Pustaka `pywebview.api` dijembatani secara reaktif di React menggunakan Custom Hook `usePyApi.ts`.

## 📌 Log Keputusan Utama
1.  **Penggunaan Select HTML Native (25 Mei 2026):**
    *   *Masalah:* Dropdown Shadcn (Radix UI Select) mengalami tabrakan tata letak, melayang tidak sejajar, dan meluap ke atas tombol di WebView2 karena perilaku portal absolut.
    *   *Solusi:* Menggunakan tag `<select>` HTML native yang dipercantik Tailwind CSS (`w-full`, background gelap, kustomisasi panah, dsb.) demi menjamin kestabilan layout 100% di runtime WebView2 Windows.
2.  **Variabel Privat di Backend (`api.py`):**
    *   Mengubah nama properti instance backend (`_window`, `_downloader`) menjadi berawalan garis bawah (`_`) untuk mencegah serialisasi asinkron .NET COM memicu error *maximum recursion depth exceeded*.
3.  **Fitur Hapus Riwayat & File Fisik (25 Mei 2026):**
    *   *Masalah:* User membutuhkan cara untuk membersihkan riwayat unduhan, menghapus video yang tidak lagi diperlukan, serta membersihkan riwayat lama yang datanya rusak.
    *   *Solusi:* Menambahkan dialog modal konfirmasi hapus di frontend React dengan opsi checkbox *Also delete the video file from your computer*. Di backend, `api.py` akan menghapus item dari file JSON riwayat berdasarkan indeksnya dan (jika dicentang) menghapus file video fisik terkait menggunakan pencarian wildcard `glob` agar presisi meskipun ekstensinya berbeda.
4.  **Bug FFmpeg Not Found Pasca Instalasi (25 Mei 2026):**
    *   *Masalah:* Indikator dependensi FFmpeg mendeteksi status "Not Found" pada versi aplikasi terinstal. Hal ini terjadi karena PyInstaller 6 `--onedir` memindahkan data tambahan ke folder `_internal/` (tempat `sys._MEIPASS` mengarah), sementara FFmpeg diletakkan di root folder rilis (`gui/bin`).
    *   *Solusi:* Kami menganalisis masalah ini dan mendokumentasikan pemetaan ulang fungsi pencarian `check_ffmpeg` menggunakan `sys.executable` di dalam [docs/ffmpeg_not_found_issue.md](file:///d:/Documents/Belajar/APP/AI/yt-dlp/docs/ffmpeg_not_found_issue.md) untuk diselesaikan pengguna nantinya tanpa mengeksekusi perubahan kode secara langsung sekarang.

## 📦 Isi Installer (v1.0.0)
*   **yt-dlp.exe** — launcher PyWebview (engine utama)
*   **_internal/** — Python runtime, yt-dlp core, pywebview, semua modul
*   **gui/frontend/** — UI React (Vite build, static)
*   **gui/bin/ffmpeg.exe + ffprobe.exe** — FFmpeg portabel untuk post-processing
*   **gui/bin/qjs.exe** — QuickJS-ng v0.15.0 (JS runtime untuk YouTube challenge solver)
*   **gui/bin/MicrosoftEdgeWebview2Setup.exe** — bootstrapper WebView2 (auto-install jika belum ada di device)

### Perilaku Saat Install di Device Baru
1.  Installer memeriksa registry apakah WebView2 Runtime sudah terinstal.
2.  Jika belum → `MicrosoftEdgeWebview2Setup.exe /silent /install` dijalankan otomatis (butuh internet ~100MB dari Microsoft CDN).
3.  Semua dependency lain (FFmpeg, QuickJS, Python runtime) sudah terbundle — tidak perlu internet.

## 🚀 Tugas Mendatang / Langkah Selanjutnya
1.  [x] Mengganti Shadcn `<Select>` di `App.tsx` dengan select native HTML & memperbaiki layout form input dan tombol.
2.  [x] Menambahkan fitur hapus riwayat dan berkas video fisik.
3.  [x] Menjalankan kompilasi frontend (`npm run build` di `gui/frontend_react`).
4.  [x] Melakukan perbaikan pencarian FFmpeg menggunakan `sys.executable` di [gui/utils.py](file:///d:/Documents/Belajar/APP/AI/yt-dlp/gui/utils.py) (sesuai dokumentasi isu).
5.  [x] Melakukan pengujian mode pengembangan dan produksi offline untuk memastikan semua tombol (*Play*, *Open Folder*, *Download*, *Delete*) berjalan sempurna.
6.  [x] Membuat bundel installer menggunakan PyInstaller dan Inno Setup.
