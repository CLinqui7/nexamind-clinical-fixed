@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Run INSTALAR-Y-ABRIR.bat or setup.ps1 first.
  pause
  exit /b 1
)
call npm.cmd run check
pause
