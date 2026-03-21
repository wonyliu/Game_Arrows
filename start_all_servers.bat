@echo off
setlocal

cd /d "%~dp0"

set "PORT=4173"
set "HOST=127.0.0.1"

echo [1/4] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not in PATH.
    echo Install Node.js first, then re-run this script.
    pause
    exit /b 1
)

echo [2/4] Releasing port %PORT% if occupied...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>nul
)

echo [3/4] Starting dev server...
echo URL: http://%HOST%:%PORT%/
echo.

start "" "http://%HOST%:%PORT%/index.html"
start "" "http://%HOST%:%PORT%/admin.html"

echo [4/4] Running server process (keep this window open)...
node scripts\dev-server.mjs %PORT%

endlocal
