@echo off
setlocal
chcp 65001>nul

set "PS_SCRIPT=%~dp0tools\generate-admin-api-key.ps1"
if not exist "%PS_SCRIPT%" goto missing

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
if errorlevel 1 goto failed
exit /b 0

:missing
echo [ERROR] Script not found:
echo %PS_SCRIPT%
pause
exit /b 1

:failed
echo.
echo [ERROR] Failed to generate ADMIN_API_KEY.
pause
exit /b 1
