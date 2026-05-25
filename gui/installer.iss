; Script Inno Setup Compiler untuk yt-dlp GUI Installer
#define MyAppName "yt-dlp"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "muhafif24"
#define MyAppURL "https://github.com/muhafif24/yt-dlp"
#define MyAppExeName "yt-dlp.exe"

[Setup]
; Informasi dasar aplikasi
AppId={{2A8E1D94-E825-47AB-8C08-F4DE6119EF21}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
; Output installer
OutputDir=..\dist
OutputBaseFilename=yt-dlp-setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Menyalin seluruh isi folder dist/yt-dlp hasil build PyInstaller
Source: "..\dist\yt-dlp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Catatan: Biner FFmpeg sudah dimasukkan ke dalam folder dist/yt-dlp/gui/bin oleh script build_gui.py

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Filename: "{app}\{#MyAppExeName}"; Flags: nowait postinstall skipifsilent
