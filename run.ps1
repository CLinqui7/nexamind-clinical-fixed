$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
  Write-Host "No se encontraron dependencias. Ejecutando instalación primero..." -ForegroundColor Yellow
  & "$PSScriptRoot\setup.ps1"
}

Write-Host "`nAbriendo NexaMind Clinical en http://localhost:4173" -ForegroundColor Magenta
Write-Host "Para detenerlo presiona Ctrl + C.`n" -ForegroundColor DarkGray
Start-Process "http://localhost:4173"
npm run dev
