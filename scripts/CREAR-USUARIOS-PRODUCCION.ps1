param(
  [string]$Project = 'S:\Usuarios\Carlos\carlo\linkare-recuperado-20260908-125127',
  [string]$ProjectRef = 'fvucylgrqgxjqabacnlt',
  [string]$OrganizationName = 'Consultorio Principal',
  [string]$AdminEmail = 'linquicarloss@gmail.com',
  [string]$DoctorEmail = 'linquicarloss+doctor@gmail.com',
  [string]$SecretaryEmail = 'linquicarloss+secretaria@gmail.com'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Project -PathType Container)) { throw "No existe el proyecto: $Project" }
if ($ProjectRef -notmatch '^[a-z]{20}$') { throw 'ProjectRef invalido.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js no esta disponible.' }

Set-Location -LiteralPath $Project
if (-not (Test-Path '.\node_modules\@supabase\supabase-js')) {
  & npm.cmd ci --include=dev
  if ($LASTEXITCODE -ne 0) { throw 'npm ci fallo.' }
}

function Read-Secret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$serviceRole = Read-Secret 'Pegue SUPABASE SERVICE ROLE KEY (no se guardara)'
$adminPassword = Read-Secret "Password temporal para $AdminEmail (puede escribir linquipro)"
$doctorPassword = Read-Secret "Password temporal para $DoctorEmail (12+ recomendado)"
$secretaryPassword = Read-Secret "Password temporal para $SecretaryEmail (12+ recomendado)"

if ([string]::IsNullOrWhiteSpace($serviceRole)) { throw 'Falta service role key.' }
if ([string]::IsNullOrWhiteSpace($adminPassword)) { throw 'Falta password admin.' }
if ($doctorPassword.Length -lt 12) { throw 'Use al menos 12 caracteres para el medico.' }
if ($secretaryPassword.Length -lt 12) { throw 'Use al menos 12 caracteres para secretaria.' }

$env:SUPABASE_URL = "https://$ProjectRef.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = $serviceRole
$env:LINKARE_ADMIN_PASSWORD = $adminPassword
$env:LINKARE_DOCTOR_PASSWORD = $doctorPassword
$env:LINKARE_SECRETARY_PASSWORD = $secretaryPassword

try {
  & node '.\scripts\bootstrap-production-users.mjs' `
    --url $env:SUPABASE_URL `
    --org $OrganizationName `
    --admin-email $AdminEmail `
    --doctor-email $DoctorEmail `
    --secretary-email $SecretaryEmail
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron crear los usuarios.' }
} finally {
  Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:LINKARE_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:LINKARE_DOCTOR_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:LINKARE_SECRETARY_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_URL -ErrorAction SilentlyContinue
  $serviceRole = $null; $adminPassword = $null; $doctorPassword = $null; $secretaryPassword = $null
}

Write-Host ''
Write-Host 'USUARIOS DE PRODUCCION CONFIGURADOS.' -ForegroundColor Green
Write-Host "Admin: $AdminEmail"
Write-Host "Medico: $DoctorEmail"
Write-Host "Secretaria: $SecretaryEmail"
Write-Host 'No se guardaron las contrasenas en archivos.'
