param([switch]$Headed)
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Venv = Join-Path $Root '.qa-selenium-venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
$TestFile = Join-Path $PSScriptRoot 'test_linkare.py'
$OldTest = Join-Path $PSScriptRoot 'test_nexamind.py'
$ServerProcess = $null
$StartedServer = $false

if (Test-Path -LiteralPath $OldTest) {
  Remove-Item -LiteralPath $OldTest -Force
  Write-Host 'Suite antigua test_nexamind.py eliminada.' -ForegroundColor Yellow
}

if (-not (Test-Path -LiteralPath $Python)) {
  py -m venv $Venv
}

& $Python -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar las dependencias de Selenium.' }

try {
  $serverReady = $false
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173' -UseBasicParsing -TimeoutSec 2
    $serverReady = $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch { $serverReady = $false }

  if (-not $serverReady) {
    Write-Host 'Iniciando Vite para la prueba...' -ForegroundColor Cyan
    $ServerProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev') -WorkingDirectory $Root -PassThru -WindowStyle Hidden
    $StartedServer = $true
    for ($attempt = 1; $attempt -le 30; $attempt++) {
      Start-Sleep -Milliseconds 500
      try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { $serverReady = $true; break }
      } catch {}
    }
    if (-not $serverReady) { throw 'Vite no respondió en http://127.0.0.1:4173' }
  }

  if ($Headed) { $env:HEADED = '1' } else { $env:HEADED = '0' }
  $env:LINKARE_BASE_URL = 'http://127.0.0.1:4173'
  Push-Location $Root
  try {
    & $Python $TestFile
    if ($LASTEXITCODE -ne 0) { throw 'Selenium QA encontró fallos.' }
  } finally {
    Pop-Location
  }
}
finally {
  if ($StartedServer -and $ServerProcess -and -not $ServerProcess.HasExited) {
    Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
  }
}

Write-Host 'LINKARE SELENIUM QA OK' -ForegroundColor Green
