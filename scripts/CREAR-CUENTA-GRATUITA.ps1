param([Parameter(Mandatory=$true)][string]$Email,[Parameter(Mandatory=$true)][string]$FullName,[Parameter(Mandatory=$true)][string]$ClinicName,[string]$ResumeUserId)
$ErrorActionPreference='Stop'
if (-not $env:SUPABASE_URL) { $env:SUPABASE_URL='https://fvucylgrqgxjqabacnlt.supabase.co' }
$temporarySecret=$false
try {
  if (-not $env:SUPABASE_SERVICE_ROLE_KEY -and -not $env:SUPABASE_SECRET_KEY) {
    $secureKey=Read-Host 'Clave administrativa Supabase (entrada oculta)' -AsSecureString
    $env:SUPABASE_SERVICE_ROLE_KEY=[System.Net.NetworkCredential]::new('', $secureKey).Password
    $temporarySecret=$true
  }
  if (-not $ResumeUserId) {
    $securePassword=Read-Host 'Contraseña temporal (mínimo 12 caracteres; entrada oculta)' -AsSecureString
    $env:LINKARE_TEMP_PASSWORD=[System.Net.NetworkCredential]::new('', $securePassword).Password
  }
  $accountArgs=@((Join-Path $PSScriptRoot 'create-free-account.mjs'),'--email',$Email,'--fullName',$FullName,'--clinicName',$ClinicName)
  if ($ResumeUserId) { $accountArgs+=@('--resume-user-id',$ResumeUserId) }
  & node @accountArgs
  if ($LASTEXITCODE -ne 0) { throw 'La creación no terminó. Revise el mensaje anterior; no se borró ninguna cuenta.' }
} finally {
  Remove-Item Env:LINKARE_TEMP_PASSWORD -ErrorAction SilentlyContinue
  if ($temporarySecret) { Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue }
}
