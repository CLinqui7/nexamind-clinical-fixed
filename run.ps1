$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command "node" -ErrorAction SilentlyContinue) -or -not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js or npm is missing. Running the installer..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "setup.ps1")
}

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "Project dependencies are missing. Running the installer..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "setup.ps1")
}

$npmCommand = (Get-Command "npm.cmd" -ErrorAction Stop).Source

Write-Host "" 
Write-Host "NexaMind Clinical will open at:" -ForegroundColor Blue
Write-Host "http://localhost:4173" -ForegroundColor Cyan
Write-Host "To stop the server, return to this window and press Ctrl + C." -ForegroundColor DarkGray

Start-Process "http://localhost:4173"
& $npmCommand run dev
if ($LASTEXITCODE -ne 0) {
    throw "The development server could not start. Run npm.cmd run check to inspect the error."
}
