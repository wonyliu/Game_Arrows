@echo off
setlocal

cd /d "%~dp0"

set "PORT=4173"
set "HOST=127.0.0.1"
set "BASE_URL=http://%HOST%:%PORT%"
set "DEFAULT_LOCAL_DB_URL=postgres://game_arrows:GameArrows_2026_db@127.0.0.1:5432/game_arrows"

echo [1/8] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed or not in PATH.
    echo Install Node.js first, then re-run this script.
    pause
    exit /b 1
)

echo [2/8] Loading API keys from User environment...
set "FREESOUND_API_KEY="
set "HUGGINGFACE_API_TOKEN="
set "FAL_KEY="
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('FREESOUND_API_KEY','User')"`) do set "FREESOUND_API_KEY=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('HUGGINGFACE_API_TOKEN','User')"`) do set "HUGGINGFACE_API_TOKEN=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('FAL_KEY','User')"`) do set "FAL_KEY=%%V"
if defined FREESOUND_API_KEY (echo   FREESOUND_API_KEY loaded.) else (echo   FREESOUND_API_KEY missing.)
if defined HUGGINGFACE_API_TOKEN (echo   HUGGINGFACE_API_TOKEN loaded.) else (echo   HUGGINGFACE_API_TOKEN missing.)
if defined FAL_KEY (echo   FAL_KEY loaded.) else (echo   FAL_KEY missing.)

echo [3/8] Loading local database/backend environment...
set "USER_CENTER_BACKEND="
set "USER_CENTER_DATABASE_URL="
set "DATABASE_URL="
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('USER_CENTER_BACKEND','User')"`) do set "USER_CENTER_BACKEND=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('USER_CENTER_DATABASE_URL','User')"`) do set "USER_CENTER_DATABASE_URL=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('DATABASE_URL','User')"`) do set "DATABASE_URL=%%V"

if not defined USER_CENTER_BACKEND set "USER_CENTER_BACKEND=postgres"
if not defined USER_CENTER_DATABASE_URL if defined DATABASE_URL set "USER_CENTER_DATABASE_URL=%DATABASE_URL%"
if not defined USER_CENTER_DATABASE_URL set "USER_CENTER_DATABASE_URL=%DEFAULT_LOCAL_DB_URL%"
echo %USER_CENTER_DATABASE_URL% | findstr /R /I "^postgres://[^:@/][^@/]*:[^@/][^@/]*@[^/][^/]*" >nul
if errorlevel 1 (
    echo   WARNING: USER_CENTER_DATABASE_URL format invalid. Fallback to default local db url.
    set "USER_CENTER_DATABASE_URL=%DEFAULT_LOCAL_DB_URL%"
)

set "CORS_ALLOWED_ORIGINS=https://wonyliu.github.io,http://127.0.0.1:%PORT%,http://localhost:%PORT%"
set "CORS_ALLOW_TRYCLOUDFLARE=1"

echo   USER_CENTER_BACKEND=%USER_CENTER_BACKEND%
echo   USER_CENTER_DATABASE_URL=%USER_CENTER_DATABASE_URL%

echo [4/8] Ensuring PostgreSQL driver (pg) is installed...
if not exist "package.json" (
    echo   package.json not found. Initializing npm project...
    call npm init -y >nul 2>nul
    if errorlevel 1 (
        echo   Failed to initialize npm project.
        pause
        exit /b 1
    )
)
call npm ls pg --depth=0 >nul 2>nul
if errorlevel 1 (
    echo   Installing npm package: pg
    call npm i pg
    if errorlevel 1 (
        echo   Failed to install pg. Please run: npm i pg
        pause
        exit /b 1
    )
) else (
    echo   pg is already installed.
)

echo [5/8] Releasing port %PORT% if occupied...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>nul
)

echo [6/8] Scheduling page open (wait until server is ready)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$base='%BASE_URL%'; $deadline=(Get-Date).AddSeconds(30); " ^
  "while((Get-Date) -lt $deadline){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri ($base + '/api/leaderboard') -TimeoutSec 2; if($r.StatusCode -ge 200){ break } } catch {}; Start-Sleep -Milliseconds 500 }; " ^
  "Start-Process ($base + '/index.html'); Start-Process ($base + '/admin.html')" >nul 2>nul

echo [7/8] Starting dev server in this window...
echo URL: %BASE_URL%/
echo Press Ctrl+C to stop server.
echo.
node scripts\dev-server.mjs %PORT%

echo.
echo [8/8] Dev server exited.
pause
endlocal
