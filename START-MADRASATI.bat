@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules" call npm install
if not exist ".env" (
 node setup-local.mjs
 call npm run seed:demo
)
powershell -NoProfile -Command "try { Invoke-WebRequest 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
 start "Madrasati Live" cmd /k "npm run dev"
 timeout /t 4 /nobreak >nul
)
start "" "http://127.0.0.1:5173/"
echo The browser has been opened. Keep the Madrasati Live window running.
pause
