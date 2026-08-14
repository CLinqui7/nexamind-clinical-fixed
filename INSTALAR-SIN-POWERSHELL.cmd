@echo off
setlocal
cd /d "%~dp0"
echo.
echo NexaMind Clinical 1.2.1 - direct Windows installer
echo.
if not exist package.json (
  echo ERROR: package.json was not found in this folder.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 goto installnode
where npm.cmd >nul 2>&1
if errorlevel 1 goto installnode

node -e "const v=process.versions.node.split('.').map(Number);process.exit((v[0]>22||(v[0]===22&&v[1]>=12)||(v[0]===20&&v[1]>=19))?0:1)"
if errorlevel 1 goto installnode
goto installproject

:installnode
where winget >nul 2>&1
if errorlevel 1 (
  echo Node.js LTS is required.
  echo Install it from https://nodejs.org, reopen this folder, and run this file again.
  pause
  exit /b 1
)

echo Installing or updating Node.js LTS with winget...
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
if errorlevel 1 (
  echo winget could not install Node.js. Install it from https://nodejs.org.
  pause
  exit /b 1
)

echo.
echo Node.js was installed or updated.
echo Close this window and run INSTALAR-SIN-POWERSHELL.cmd again.
pause
exit /b 0

:installproject
echo Node version:
node -v
echo npm version:
call npm.cmd -v
echo.
echo Installing dependencies...
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto fail
echo.
echo Validating project...
call npm.cmd run check
if errorlevel 1 goto fail
echo.
echo Installation completed. Starting NexaMind Clinical...
start "" "http://localhost:4173"
call npm.cmd run dev
exit /b %errorlevel%

:fail
echo.
echo Installation failed. Review the error shown above.
pause
exit /b 1
