@echo off
title Monopoli Antariksa - Server Online
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%PATH%

if not exist tools\cloudflared.exe (
  echo Mengunduh cloudflared ^(sekali saja^)...
  powershell -NoProfile -Command "New-Item -ItemType Directory -Force tools | Out-Null; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile tools\cloudflared.exe"
)

echo [1/3] Membangun client...
call npm run build --prefix client

echo [2/3] Menyalakan server game...
start "Monopoli Server" cmd /k "set PATH=C:\Program Files\nodejs;%%PATH%% && npm start --prefix server"
timeout /t 5 /nobreak >nul

echo [3/3] Membuka terowongan internet...
echo.
echo  ============================================================
echo   Tunggu sebentar - alamat publik https://....trycloudflare.com
echo   akan muncul di bawah ini. BAGIKAN alamat itu ke pemain lain.
echo   Biarkan jendela ini TETAP TERBUKA selama bermain.
echo  ============================================================
echo.
tools\cloudflared.exe tunnel --url http://localhost:3001
