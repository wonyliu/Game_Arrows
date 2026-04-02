@echo off
setlocal

cd /d "%~dp0"

set "PORT=4173"
set "HOST=127.0.0.1"
set "BASE_URL=http://%HOST%:%PORT%"

echo [1/6] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not in PATH.
    echo Install Node.js first, then re-run this script.
    pause
    exit /b 1
)

echo [2/6] Loading API keys from User environment...
set "FREESOUND_API_KEY="
set "HUGGINGFACE_API_TOKEN="
set "FAL_KEY="
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('FREESOUND_API_KEY','User')"`) do set "FREESOUND_API_KEY=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('HUGGINGFACE_API_TOKEN','User')"`) do set "HUGGINGFACE_API_TOKEN=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('FAL_KEY','User')"`) do set "FAL_KEY=%%V"
if defined FREESOUND_API_KEY (echo   FREESOUND_API_KEY loaded.) else (echo   FREESOUND_API_KEY missing.)
if defined HUGGINGFACE_API_TOKEN (echo   HUGGINGFACE_API_TOKEN loaded.) else (echo   HUGGINGFACE_API_TOKEN missing.)
if defined FAL_KEY (echo   FAL_KEY loaded.) else (echo   FAL_KEY missing.)

echo [3/6] Releasing port %PORT% if occupied...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>nul
)

echo [4/6] Scheduling page open...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Sleep -Seconds 2; Start-Process '%BASE_URL%/index.html'; Start-Process '%BASE_URL%/admin.html'" >nul 2>nul

echo [5/6] Starting dev server in this window...
echo URL: %BASE_URL%/
echo Press Ctrl+C to stop server.
echo.
node scripts\dev-server.mjs %PORT%

echo.
echo [6/6] Dev server exited.
pause
endlocal
