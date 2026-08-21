@echo off
setlocal
cd /d "%~dp0\..\.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\qa\selenium\RUN-SELENIUM-QA.ps1" -Project "%CD%"
if errorlevel 1 (
  echo.
  echo Selenium QA encontro errores.
  pause
  exit /b 1
)
echo.
echo Selenium QA finalizada correctamente.
pause
