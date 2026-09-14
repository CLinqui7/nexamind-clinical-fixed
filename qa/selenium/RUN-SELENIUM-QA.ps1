param([switch]$Headed,[string]$BaseUrl='http://localhost:4173')
$ErrorActionPreference='Stop'
Push-Location (Join-Path $PSScriptRoot '..\..')
try {
 if (-not (Test-Path '.qa-selenium-venv\Scripts\python.exe')) {
  & py -3 -m venv .qa-selenium-venv
  if ($LASTEXITCODE -ne 0) { throw 'Python 3 is required.' }
 }
 & '.\.qa-selenium-venv\Scripts\python.exe' -m pip install -r '.\qa\selenium\requirements.txt'
 if ($LASTEXITCODE -ne 0) { throw 'Selenium installation failed.' }
 $env:LINKARE_QA_URL=$BaseUrl
 $env:LINKARE_QA_HEADED=$(if($Headed){'1'}else{'0'})
 & '.\.qa-selenium-venv\Scripts\python.exe' '.\qa\selenium\test_linkare.py'
 if ($LASTEXITCODE -ne 0) { throw 'Public access smoke tests failed.' }
} finally { Pop-Location }
