@echo off
setlocal
title Madrasati Live Launcher
cd /d "%~dp0"
if not exist ".env" (
 echo Missing .env. See README.md for first time setup.
 pause
 exit /b 1
)
if not exist "node_modules\vite" (
 echo Installing dependencies...
 call npm ci
 if errorlevel 1 (
  echo Installation failed. Check your network and npm.
  pause
  exit /b 1
 )
)
curl.exe -sS -f "http://127.0.0.1:5173/" >nul 2>nul
if errorlevel 1 (
 echo Starting Madrasati Live...
 start "Madrasati Live - Keep Open" /D "%~dp0" cmd.exe /k "npm run dev"
 timeout /t 6 /nobreak >nul
)
echo Opening http://127.0.0.1:5173/
start "" "http://127.0.0.1:5173/"
exit /b 0
