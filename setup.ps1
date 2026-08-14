$ErrorActionPreference = "Stop"

Write-Host "`nNexaMind Clinical | Instalación automática" -ForegroundColor Magenta
Write-Host "Directorio: $PSScriptRoot`n"
Set-Location $PSScriptRoot

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Install-NodeLts {
  if (-not (Test-Command "winget")) {
    throw "No encontré winget. Instala Node.js LTS desde nodejs.org, abre una nueva terminal y vuelve a ejecutar .\setup.ps1."
  }

  Write-Host "Instalando o actualizando Node.js LTS con winget..." -ForegroundColor Cyan
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  Write-Host "Node.js LTS fue instalado o actualizado." -ForegroundColor Green
  Write-Host "Cierra PowerShell, ábrelo de nuevo y ejecuta .\setup.ps1 otra vez para refrescar PATH." -ForegroundColor Yellow
  exit 0
}

if (-not (Test-Command "node")) {
  Write-Host "Node.js no está instalado." -ForegroundColor Yellow
  Install-NodeLts
}

$nodeParts = (node -v).TrimStart('v').Split('.')
$nodeMajor = [int]$nodeParts[0]
$nodeMinor = [int]$nodeParts[1]
$nodeCompatible = ($nodeMajor -gt 22) -or (($nodeMajor -eq 22) -and ($nodeMinor -ge 12)) -or (($nodeMajor -eq 20) -and ($nodeMinor -ge 19))

if (-not $nodeCompatible) {
  Write-Host "La versión $(node -v) no cumple el requisito actual de Vite." -ForegroundColor Yellow
  Install-NodeLts
}

Write-Host "Node: $(node -v)" -ForegroundColor Green
Write-Host "npm:  $(npm -v)" -ForegroundColor Green

if (-not (Test-Path "package.json")) {
  throw "No encuentro package.json. Estás en la carpeta incorrecta o usas el ZIP anterior incompleto."
}

Write-Host "`nInstalando dependencias..." -ForegroundColor Cyan
npm install

Write-Host "`nValidando código y generando build..." -ForegroundColor Cyan
npm run check

Write-Host "`nInstalación completada." -ForegroundColor Green
Write-Host "Ahora ejecuta: .\run.ps1" -ForegroundColor White
