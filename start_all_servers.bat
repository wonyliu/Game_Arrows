@echo off
setlocal

cd /d "%~dp0"

set "PORT=4173"
set "HOST=127.0.0.1"
set "BASE_URL=http://%HOST%:%PORT%"

echo [1/5] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not in PATH.
    echo Install Node.js first, then re-run this script.
    pause
    exit /b 1
)

echo [2/5] Releasing port %PORT% if occupied...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>nul
)

echo [3/5] Scheduling page open...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Sleep -Seconds 2; Start-Process '%BASE_URL%/index.html'; Start-Process '%BASE_URL%/admin.html'; Start-Process '%BASE_URL%/skin-fit-tool.html'" >nul 2>nul

echo [4/5] Starting dev server in this window...
echo URL: %BASE_URL%/
echo Press Ctrl+C to stop server.
echo.
node scripts\dev-server.mjs %PORT%

echo.
echo [5/5] Dev server exited.
pause
endlocal
