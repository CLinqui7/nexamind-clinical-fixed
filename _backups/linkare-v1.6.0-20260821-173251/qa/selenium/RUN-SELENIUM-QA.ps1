param([switch]$Headed)
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$Venv = Join-Path $Root '.qa-selenium-venv'
$Python = Join-Path $Venv 'Scripts\python.exe'
if (-not (Test-Path $Python)) { py -m venv $Venv }
& $Python -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($Headed) { $env:HEADED = '1' } else { $env:HEADED = '0' }
Push-Location $Root
try { & $Python (Join-Path $PSScriptRoot 'test_linkare.py') } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'Selenium QA encontró fallos.' }
