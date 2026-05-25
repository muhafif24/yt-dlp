; Script Inno Setup Compiler untuk yt-dlp GUI Installer
#define MyAppName "Fetchr"
#define MyAppVersion "1.2.0"
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
SetupIconFile=..\fetchr.ico
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Seluruh isi folder dist/yt-dlp hasil build PyInstaller
Source: "..\dist\yt-dlp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; WebView2 bootstrapper — disalin ke temp dan dijalankan saat install (dihapus setelah install selesai)
Source: "..\gui\bin\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Install WebView2 Runtime jika belum terinstal (membutuhkan koneksi internet)
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; \
  StatusMsg: "Installing Microsoft Edge WebView2 Runtime..."; \
  Check: not IsWebView2Installed; Flags: waituntilterminated
; Tawarkan untuk langsung menjalankan aplikasi setelah install
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; \
  Flags: nowait postinstall skipifsilent

[Code]
function IsWebView2Installed: Boolean;
var
  Version: String;
begin
  Result := False;
  // Cek di HKLM 32-bit node (paling umum untuk WebView2 machine-level)
  if RegQueryStringValue(HKLM,
      'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
      'pv', Version) then
  begin
    if (Version <> '') and (Version <> '0.0.0.0') then
    begin
      Result := True;
      Exit;
    end;
  end;
  // Cek di HKLM 64-bit node
  if RegQueryStringValue(HKLM,
      'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
      'pv', Version) then
  begin
    if (Version <> '') and (Version <> '0.0.0.0') then
    begin
      Result := True;
      Exit;
    end;
  end;
  // Cek di HKCU (user-level install)
  if RegQueryStringValue(HKCU,
      'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
      'pv', Version) then
  begin
    if (Version <> '') and (Version <> '0.0.0.0') then
      Result := True;
  end;
end;
