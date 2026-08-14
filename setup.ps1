$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

function Test-Tool {
    param([Parameter(Mandatory = $true)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Install-NodeLts {
    if (-not (Test-Tool -Name "winget")) {
        throw "Node.js is missing and winget is not available. Install Node.js LTS from https://nodejs.org, reopen PowerShell, and run setup.ps1 again."
    }

    Write-Host "" 
    Write-Host "Installing or updating Node.js LTS with winget..." -ForegroundColor Cyan
    & winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {
        throw "winget could not install Node.js LTS. Install it from https://nodejs.org and run setup.ps1 again."
    }

    Refresh-ProcessPath

    if (-not (Test-Tool -Name "node") -or -not (Test-Tool -Name "npm.cmd")) {
        Write-Host "" 
        Write-Host "Node.js was installed, but Windows must refresh PATH." -ForegroundColor Yellow
        Write-Host "Close this window, open it again, and run the installer one more time." -ForegroundColor Yellow
        exit 20
    }
}

function Get-NodeVersion {
    $raw = (& node -p "process.versions.node").Trim()
    try {
        return [version]$raw
    }
    catch {
        throw "Could not read the installed Node.js version: $raw"
    }
}

function Test-SupportedNode {
    param([Parameter(Mandatory = $true)][version]$Version)
    return ($Version.Major -gt 22) -or (($Version.Major -eq 22) -and ($Version.Minor -ge 12)) -or (($Version.Major -eq 20) -and ($Version.Minor -ge 19))
}

Write-Host "" 
Write-Host "==================================================" -ForegroundColor DarkBlue
Write-Host "  NexaMind Clinical 1.2.1 | Windows setup" -ForegroundColor Blue
Write-Host "==================================================" -ForegroundColor DarkBlue
Write-Host "Project folder: $PSScriptRoot"

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json"))) {
    throw "package.json was not found. Run this installer from the extracted NexaMind Clinical folder."
}

if (-not (Test-Tool -Name "node") -or -not (Test-Tool -Name "npm.cmd")) {
    Install-NodeLts
}

$nodeVersion = Get-NodeVersion
if (-not (Test-SupportedNode -Version $nodeVersion)) {
    Write-Host "Detected Node.js version: $nodeVersion" -ForegroundColor Yellow
    Install-NodeLts
    $nodeVersion = Get-NodeVersion

    if (-not (Test-SupportedNode -Version $nodeVersion)) {
        throw "This project requires Node.js 20.19+, 22.12+, or a newer supported version."
    }
}

$npmCommand = (Get-Command "npm.cmd" -ErrorAction Stop).Source
$npmVersion = (& $npmCommand --version).Trim()

Write-Host "" 
Write-Host "Node: v$nodeVersion" -ForegroundColor Green
Write-Host "npm:  $npmVersion" -ForegroundColor Green

Write-Host "" 
Write-Host "Installing project dependencies..." -ForegroundColor Cyan
& $npmCommand install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed with exit code $LASTEXITCODE. Review the message above."
}

Write-Host "" 
Write-Host "Running syntax checks, tests, and production build..." -ForegroundColor Cyan
& $npmCommand run check
if ($LASTEXITCODE -ne 0) {
    throw "npm run check failed with exit code $LASTEXITCODE. Review the message above."
}

Write-Host "" 
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host "  INSTALLATION COMPLETED" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor DarkGreen
Write-Host "Run the application with:" -ForegroundColor White
Write-Host "  .\run.ps1" -ForegroundColor Yellow
Write-Host "You can also double-click ABRIR-NEXAMIND.bat." -ForegroundColor DarkGray
