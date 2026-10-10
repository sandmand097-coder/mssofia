@echo off
setlocal
title mrsofia - Miss Sofia Science School
cd /d "%~dp0"
if not exist ".env" (
  echo Environment file missing. Read README.md before first use.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)
curl.exe -sS -f "http://127.0.0.1:5173/" >nul 2>nul
if errorlevel 1 (
  echo Starting Miss Sofia development server...
  start "mrsofia - Keep this window open" /D "%~dp0" cmd.exe /k "npm run dev"
  timeout /t 6 /nobreak >nul
)
echo Opening Miss Sofia - http://127.0.0.1:5173
start "" "http://127.0.0.1:5173/"
exit /b 0
