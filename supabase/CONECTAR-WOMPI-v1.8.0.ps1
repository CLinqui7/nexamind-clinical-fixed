param(
  [string]$ProjectRef = "",
  [string]$PublicUrl = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $ProjectRef) { $ProjectRef = Read-Host "Supabase Project Ref (20 caracteres)" }
if (-not $PublicUrl) { $PublicUrl = Read-Host "URL publica de Vercel (https://...)" }
if (-not $ProjectRef) { throw "Debe indicar el Project Ref de Supabase." }
if (-not $PublicUrl) { throw "Debe indicar la URL publica de Vercel." }

$clientId = Read-Host "Wompi App ID"
$clientSecretSecure = Read-Host "Wompi API Secret" -AsSecureString
$notificationEmail = Read-Host "Correo para notificaciones Wompi"
$clientSecret = [System.Net.NetworkCredential]::new("", $clientSecretSecure).Password
$tempFile = Join-Path $env:TEMP "linkare-wompi-$ProjectRef.env"

@"
WOMPI_CLIENT_ID=$clientId
WOMPI_CLIENT_SECRET=$clientSecret
WOMPI_AUTH_URL=https://id.wompi.sv/connect/token
WOMPI_API_URL=https://api.wompi.sv
WOMPI_AUDIENCE=wompi_api
APP_PUBLIC_URL=$PublicUrl
WOMPI_NOTIFICATION_EMAIL=$notificationEmail
WOMPI_REQUIRE_AUTH=true
"@ | Set-Content -LiteralPath $tempFile -Encoding utf8

Push-Location (Split-Path -Parent $root)
try {
  npx supabase@latest login
  npx supabase@latest link --project-ref $ProjectRef
  npx supabase@latest secrets set --env-file $tempFile --project-ref $ProjectRef
  npx supabase@latest functions deploy wompi-app-info --project-ref $ProjectRef --no-verify-jwt
  npx supabase@latest functions deploy wompi-create-link --project-ref $ProjectRef --no-verify-jwt
  npx supabase@latest functions deploy wompi-webhook --project-ref $ProjectRef --no-verify-jwt

  Write-Host "" 
  Write-Host "Wompi conectado a Supabase." -ForegroundColor Green
  Write-Host "Webhook Wompi:" -ForegroundColor Cyan
  Write-Host "https://$ProjectRef.supabase.co/functions/v1/wompi-webhook" -ForegroundColor Yellow
  Write-Host "" 
  Write-Host "Ahora configure ese webhook en Wompi si el panel lo solicita." -ForegroundColor Cyan
} finally {
  Pop-Location
  Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  $clientSecret = $null
}
