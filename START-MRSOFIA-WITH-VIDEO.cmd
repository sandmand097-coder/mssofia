@echo off
setlocal
title Mrs Sofia - Local Video Classroom
cd /d "%~dp0"
set "VIDEO_EXE=%~dp0..\mrssofia-local-tools\livekit\livekit-server.exe"

if not exist "%VIDEO_EXE%" (
  echo Local LiveKit was not found.
  echo Check the file in Documents\mrssofia-local-tools\livekit
  pause
  exit /b 1
)

rem Local-only demo: not accessible to students on other networks.
curl.exe -s --max-time 2 "http://127.0.0.1:7880/" >nul 2>nul
if errorlevel 1 (
  echo Starting LiveKit locally on 127.0.0.1 only...
  start "Mrs Sofia - LiveKit local" /MIN "%VIDEO_EXE%" --dev --bind 127.0.0.1 --node-ip 127.0.0.1
  timeout /t 3 /nobreak >nul
)

curl.exe -s --max-time 3 "http://127.0.0.1:7880/" >nul 2>nul
if errorlevel 1 (
  echo LiveKit did not respond. Check the LiveKit console.
  pause
  exit /b 1
)
echo Local video engine is ready.
call "%~dp0START-MRSOFIA.cmd"
exit /b 0
