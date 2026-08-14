@echo off
setlocal
cd /d "%~dp0"
echo.
echo Installing NexaMind Clinical...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
set "SETUP_CODE=%ERRORLEVEL%"
if "%SETUP_CODE%"=="20" (
  echo.
  echo Node.js was installed. Close this window, open it again, and run this installer one more time.
  pause
  exit /b 0
)
if not "%SETUP_CODE%"=="0" (
  echo.
  echo Installation did not finish correctly. Review the message above.
  pause
  exit /b %SETUP_CODE%
)
echo.
echo Opening NexaMind Clinical...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
