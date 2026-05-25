# Panduan Build — yt-dlp GUI Desktop

Dokumen ini menjelaskan cara menyiapkan environment, menjalankan mode development, dan membuat installer distribusi untuk aplikasi yt-dlp GUI.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Struktur Folder Penting](#2-struktur-folder-penting)
3. [Setup Awal (Sekali Jalan)](#3-setup-awal-sekali-jalan)
4. [Mode Development](#4-mode-development)
5. [Build Frontend (React → Static)](#5-build-frontend-react--static)
6. [Build Aplikasi (PyInstaller)](#6-build-aplikasi-pyinstaller)
7. [Build Installer (Inno Setup)](#7-build-installer-inno-setup)
8. [Alur Build Lengkap (Dari Nol ke Installer)](#8-alur-build-lengkap-dari-nol-ke-installer)
9. [Catatan Penting](#9-catatan-penting)

> **Baru di mesin ini?** Langsung ke [Setup Awal → Download Biner Otomatis](#34-download-biner-guibin-otomatis) untuk mengunduh semua dependency dengan satu blok perintah.

---

## 1. Prasyarat

Pastikan semua tools berikut sudah terinstal di mesin build sebelum melanjutkan.

| Tool | Versi Minimum | Kegunaan |
|------|--------------|----------|
| **Python** | 3.10+ | Runtime backend & PyInstaller |
| **Node.js** | 18+ (untuk dev) | Build frontend React (hanya saat development) |
| **uv** atau **pip** | — | Manajemen virtual environment Python |
| **PyInstaller** | 6.0+ | Paket Python → EXE |
| **Inno Setup 6** | 6.0+ | Buat file installer `.exe` |

> **Inno Setup** dapat diunduh dari: https://jrsoftware.org/isdl.php
>
> Path default setelah instalasi: `C:\Users\<nama>\AppData\Local\Programs\Inno Setup 6\ISCC.exe`

### Biner Wajib di `gui/bin/`

File-file berikut harus ada di folder `gui/bin/` sebelum build.
Lihat [Bagian 3.4](#34-download-biner-guibin-otomatis) untuk perintah download otomatis.

| File | Sumber | Keterangan |
|------|--------|------------|
| `ffmpeg.exe` | https://www.gyan.dev/ffmpeg/builds/ | FFmpeg Windows x64 (essentials build) |
| `ffprobe.exe` | (sama dengan ffmpeg, satu paket) | — |
| `qjs.exe` | https://github.com/quickjs-ng/quickjs/releases | QuickJS-ng ≥ v0.12.0, aset `qjs-windows-x86_64.exe` |
| `MicrosoftEdgeWebview2Setup.exe` | https://go.microsoft.com/fwlink/p/?LinkId=2124703 | WebView2 Evergreen Bootstrapper |

---

## 2. Struktur Folder Penting

```
yt-dlp/
├── gui/
│   ├── app.py              ← Entry point PyWebview (launcher window)
│   ├── api.py              ← Backend bridge Python ↔ JavaScript
│   ├── downloader.py       ← Thread unduhan non-blocking
│   ├── utils.py            ← Utilitas (cek FFmpeg, qjs, path, dll)
│   ├── build_gui.py        ← Script build PyInstaller
│   ├── installer.iss       ← Script Inno Setup (buat installer)
│   ├── requirements.txt    ← Dependency Python (pywebview, pyinstaller)
│   ├── bin/                ← Biner portabel (ffmpeg, qjs, WebView2Setup)
│   └── frontend_react/     ← Source frontend React (Vite + TypeScript)
│       ├── src/
│       ├── package.json
│       └── vite.config.ts  ← Output build ke: ../frontend/
├── gui/frontend/           ← Hasil build React (dibuat otomatis oleh npm run build)
├── yt_dlp/                 ← yt-dlp core (engine unduhan)
├── dist/
│   ├── yt-dlp/             ← Hasil build PyInstaller (folder distribusi)
│   └── yt-dlp-setup.exe    ← Installer final (hasil Inno Setup)
└── build/                  ← File sementara PyInstaller (bisa dihapus)
```

---

## 3. Setup Awal (Sekali Jalan)

### 3.1 Clone dan Buat Virtual Environment

```powershell
# Clone repo
git clone https://github.com/muhafif24/yt-dlp.git
cd yt-dlp

# Buat virtual environment Python
python -m venv .venv

# Aktifkan venv
.venv\Scripts\activate
```

### 3.2 Install Dependency Python

```powershell
pip install -r gui/requirements.txt
# atau pakai uv:
uv pip install -r gui/requirements.txt
```

### 3.3 Install Dependency Frontend

```powershell
cd gui/frontend_react
npm install
cd ../..
```

### 3.4 Download Biner `gui/bin/` (Otomatis)

Jalankan blok perintah berikut dari **root project** untuk mengunduh semua biner yang diperlukan sekaligus.

#### PowerShell

```powershell
# Buat folder gui/bin jika belum ada
New-Item -ItemType Directory -Force -Path "gui\bin" | Out-Null

# --- FFmpeg (zip dari gyan.dev, ekstrak ffmpeg.exe + ffprobe.exe) ---
$ffmpegZip = "$env:TEMP\ffmpeg-essentials.zip"
Write-Host "Downloading FFmpeg..."
Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" `
    -OutFile $ffmpegZip -UseBasicParsing
Write-Host "Extracting FFmpeg..."
Expand-Archive -Path $ffmpegZip -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
$binSrc = Get-ChildItem "$env:TEMP\ffmpeg-extract" -Recurse -Directory -Filter "bin" | Select-Object -First 1
Copy-Item "$($binSrc.FullName)\ffmpeg.exe"  "gui\bin\ffmpeg.exe"  -Force
Copy-Item "$($binSrc.FullName)\ffprobe.exe" "gui\bin\ffprobe.exe" -Force
Remove-Item $ffmpegZip, "$env:TEMP\ffmpeg-extract" -Recurse -Force
Write-Host "FFmpeg OK."

# --- QuickJS-ng v0.15.0 (single exe) ---
Write-Host "Downloading QuickJS..."
Invoke-WebRequest -Uri "https://github.com/quickjs-ng/quickjs/releases/download/v0.15.0/qjs-windows-x86_64.exe" `
    -OutFile "gui\bin\qjs.exe" -UseBasicParsing
Write-Host "QuickJS OK."

# --- WebView2 Bootstrapper ---
Write-Host "Downloading WebView2 Bootstrapper..."
Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" `
    -OutFile "gui\bin\MicrosoftEdgeWebview2Setup.exe" -UseBasicParsing
Write-Host "WebView2 Setup OK."

Write-Host "`nSemua biner siap di gui/bin/:"
Get-ChildItem "gui\bin\" | Format-Table Name, @{N='Size';E={"{0:N0} KB" -f ($_.Length/1KB)}}
```

#### curl (alternatif, lebih cepat untuk jaringan lambat)

```powershell
# Buat folder
New-Item -ItemType Directory -Force -Path "gui\bin" | Out-Null

# FFmpeg — download zip lalu ekstrak dengan PowerShell
curl -L -o "$env:TEMP\ffmpeg-essentials.zip" "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
Expand-Archive -Path "$env:TEMP\ffmpeg-essentials.zip" -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
$b = Get-ChildItem "$env:TEMP\ffmpeg-extract" -Recurse -Directory -Filter "bin" | Select-Object -First 1
Copy-Item "$($b.FullName)\ffmpeg.exe"  "gui\bin\ffmpeg.exe"
Copy-Item "$($b.FullName)\ffprobe.exe" "gui\bin\ffprobe.exe"
Remove-Item "$env:TEMP\ffmpeg-essentials.zip", "$env:TEMP\ffmpeg-extract" -Recurse -Force

# QuickJS
curl -L -o "gui\bin\qjs.exe" "https://github.com/quickjs-ng/quickjs/releases/download/v0.15.0/qjs-windows-x86_64.exe"

# WebView2 Bootstrapper
curl -L -o "gui\bin\MicrosoftEdgeWebview2Setup.exe" "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
```

> **Catatan ukuran download:**
> - FFmpeg essentials zip: ~75 MB (setelah ekstrak, hanya `ffmpeg.exe` + `ffprobe.exe` yang disimpan)
> - QuickJS `qjs.exe`: ~2 MB
> - WebView2 Bootstrapper: ~2 MB

---

## 4. Mode Development

Mode development menggunakan **Vite dev server** dengan Hot Module Replacement (HMR) agar perubahan UI langsung terlihat tanpa rebuild.

### 4.1 Aktifkan DEV_MODE

Buka [gui/app.py](../gui/app.py) dan ubah flag di baris atas fungsi `main()`:

```python
DEV_MODE = True   # ← ubah ke True untuk development
```

> Saat `DEV_MODE = True`:
> - PyWebview memuat UI dari `http://localhost:5173` (Vite dev server)
> - DevTools window terbuka otomatis (untuk inspect element / debug JS)
>
> Saat `DEV_MODE = False` (default/production):
> - PyWebview memuat dari file statis `gui/frontend/index.html`
> - Tidak ada DevTools window — hanya 1 window bersih

### 4.2 Jalankan Dev Server Frontend

```powershell
cd gui/frontend_react
npm run dev
```

Biarkan terminal ini tetap berjalan (Vite server di port 5173).

### 4.3 Jalankan Backend (Window Utama)

Buka terminal baru di root project:

```powershell
.venv\Scripts\activate
python gui/app.py
```

---

## 5. Build Frontend (React → Static)

Langkah ini mengompilasi source React menjadi file statis HTML/CSS/JS yang akan dibundle ke installer.

```powershell
cd gui/frontend_react
npm run build
```

Output otomatis ke `gui/frontend/` (dikonfigurasi di `vite.config.ts`). Hasil build sudah siap digunakan oleh `app.py` saat `DEV_MODE = False`.

> **Wajib dijalankan** setiap kali ada perubahan UI sebelum build PyInstaller.

---

## 6. Build Aplikasi (PyInstaller)

Script `gui/build_gui.py` menjalankan PyInstaller dan menyalin semua biner dari `gui/bin/` ke folder distribusi.

### 6.1 Pastikan DEV_MODE = False

Sebelum build, pastikan [gui/app.py](../gui/app.py) menggunakan:

```python
DEV_MODE = False
```

### 6.2 Jalankan Build

```powershell
.venv\Scripts\activate
python gui/build_gui.py
```

Proses ini akan:
1. Menjalankan PyInstaller (`--onedir`, tanpa console window)
2. Menghasilkan folder `dist/yt-dlp/` berisi `yt-dlp.exe` + `_internal/`
3. Menyalin semua `.exe` dari `gui/bin/` ke `dist/yt-dlp/gui/bin/`

**Hasil akhir struktur `dist/yt-dlp/`:**
```
dist/yt-dlp/
├── yt-dlp.exe
├── _internal/          ← Python runtime + semua modul
│   ├── gui/frontend/   ← UI React (static)
│   └── webview/        ← PyWebview + WebView2 loader
└── gui/bin/
    ├── ffmpeg.exe
    ├── ffprobe.exe
    ├── qjs.exe
    └── MicrosoftEdgeWebview2Setup.exe
```

> Build pertama memakan waktu ~1-2 menit. Build berikutnya lebih cepat (cache PyInstaller).

---

## 7. Build Installer (Inno Setup)

Setelah `dist/yt-dlp/` siap, buat file installer menggunakan Inno Setup:

```powershell
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Inno Setup 6\ISCC.exe" "gui\installer.iss"
```

Installer akan tersimpan di: `dist/yt-dlp-setup.exe`

### Yang Dilakukan Installer Saat Dijalankan di Device Target

1. Menyalin semua file dari `dist/yt-dlp/` ke `C:\Program Files\yt-dlp\`
2. Memeriksa registry apakah **Microsoft Edge WebView2 Runtime** sudah terinstal
3. Jika belum terinstal → menjalankan `MicrosoftEdgeWebview2Setup.exe /silent /install` secara otomatis (membutuhkan koneksi internet ~100MB dari server Microsoft)
4. Membuat shortcut di Start Menu (dan Desktop jika dipilih)

---

## 8. Alur Build Lengkap (Dari Nol ke Installer)

Urutan lengkap untuk mesin baru yang belum punya dependency apapun:

```powershell
# ── TAHAP 1: Setup Environment ──────────────────────────────────────────────

# Clone repo dan masuk ke folder
git clone https://github.com/muhafif24/yt-dlp.git
cd yt-dlp

# Buat dan aktifkan virtual environment Python
python -m venv .venv
.venv\Scripts\activate

# Install dependency Python
pip install -r gui/requirements.txt

# Install dependency frontend
cd gui/frontend_react; npm install; cd ../..


# ── TAHAP 2: Download Biner gui/bin/ ────────────────────────────────────────

New-Item -ItemType Directory -Force -Path "gui\bin" | Out-Null

# FFmpeg
curl -L -o "$env:TEMP\ffmpeg-essentials.zip" "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
Expand-Archive -Path "$env:TEMP\ffmpeg-essentials.zip" -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
$b = Get-ChildItem "$env:TEMP\ffmpeg-extract" -Recurse -Directory -Filter "bin" | Select-Object -First 1
Copy-Item "$($b.FullName)\ffmpeg.exe"  "gui\bin\ffmpeg.exe"
Copy-Item "$($b.FullName)\ffprobe.exe" "gui\bin\ffprobe.exe"
Remove-Item "$env:TEMP\ffmpeg-essentials.zip", "$env:TEMP\ffmpeg-extract" -Recurse -Force

# QuickJS
curl -L -o "gui\bin\qjs.exe" "https://github.com/quickjs-ng/quickjs/releases/download/v0.15.0/qjs-windows-x86_64.exe"

# WebView2 Bootstrapper
curl -L -o "gui\bin\MicrosoftEdgeWebview2Setup.exe" "https://go.microsoft.com/fwlink/p/?LinkId=2124703"


# ── TAHAP 3: Build ──────────────────────────────────────────────────────────

# Build frontend React → gui/frontend/
cd gui/frontend_react; npm run build; cd ../..

# [WAJIB] Pastikan DEV_MODE = False di gui/app.py sebelum lanjut
# (buka file dan cek baris: DEV_MODE = False)

# Build exe dengan PyInstaller → dist/yt-dlp/
python gui/build_gui.py

# Build installer → dist/yt-dlp-setup.exe
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Inno Setup 6\ISCC.exe" "gui\installer.iss"


# ── OUTPUT ───────────────────────────────────────────────────────────────────
# dist/yt-dlp-setup.exe  ← installer siap distribusi
```

---

## 9. Catatan Penting

### DEV_MODE — Satu Flag untuk Semuanya

| `DEV_MODE` | URL yang Dimuat | DevTools | Gunakan Untuk |
|---|---|---|---|
| `True` | `http://localhost:5173` | Terbuka | Development, debugging |
| `False` | `gui/frontend/index.html` | Tertutup | Build produksi, installer |

### Dependency Bundled vs Perlu Internet

| Komponen | Status | Keterangan |
|---|---|---|
| Python runtime | Bundled (offline) | Dibundle PyInstaller |
| yt-dlp core | Bundled (offline) | Ada di `_internal/` |
| FFmpeg + FFprobe | Bundled (offline) | Ada di `gui/bin/` |
| QuickJS (`qjs.exe`) | Bundled (offline) | Ada di `gui/bin/`, JS runtime untuk YouTube |
| WebView2 Runtime | Auto-install (perlu internet) | Di-bootstrap saat install jika belum ada |

### Troubleshooting Umum

**`FFmpeg: Not Found` setelah install**
Path detection sudah diperbaiki menggunakan `sys.executable`. Pastikan `build_gui.py` berhasil menyalin `ffmpeg.exe` ke `dist/yt-dlp/gui/bin/`.

**DevTools window muncul saat produksi**
Pastikan `DEV_MODE = False` di `gui/app.py` sebelum menjalankan `build_gui.py`.

**`dist/yt-dlp` tidak bisa ditimpa saat build**
Flag `--noconfirm` sudah ditambahkan ke `build_gui.py`. Jika masih gagal, hapus manual folder `dist/yt-dlp/` lalu build ulang.

**Installer gagal install WebView2**
Device mungkin tidak ada koneksi internet saat install. WebView2 biasanya sudah pre-installed di Windows 11 dan Windows 10 (update terbaru). Pastikan device terhubung ke internet saat pertama kali install.
