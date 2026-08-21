param(
  [string]$ProjectRef = "",
  [string]$PublicUrl = "https://nexamind-clinical.vercel.app"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $ProjectRef) { $ProjectRef = Read-Host "Supabase project ref (ej. abcdefghijklmnop)" }
if (-not $ProjectRef) { throw "Debe indicar el project ref de Supabase." }

$clientId = Read-Host "WOMPI App ID / client_id"
$clientSecret = Read-Host "WOMPI API Secret / client_secret" -AsSecureString
$notificationEmail = Read-Host "Correo para notificaciones Wompi"
$adminKey = Read-Host "Cree una clave administrativa larga para cambiar el precio" -AsSecureString
$accountSlug = Read-Host "Identificador de la cuenta (Enter para consultorio-demo)"
if (-not $accountSlug) { $accountSlug = "consultorio-demo" }

$plainSecret = [System.Net.NetworkCredential]::new("", $clientSecret).Password
$plainAdminKey = [System.Net.NetworkCredential]::new("", $adminKey).Password
$secretsFile = Join-Path $env:TEMP "linkare-wompi-secrets-$ProjectRef.env"
@"
WOMPI_CLIENT_ID=$clientId
WOMPI_CLIENT_SECRET=$plainSecret
WOMPI_AUTH_URL=https://id.wompi.sv/connect/token
WOMPI_API_URL=https://api.wompi.sv
WOMPI_AUDIENCE=wompi_api
APP_PUBLIC_URL=$PublicUrl
WOMPI_NOTIFICATION_EMAIL=$notificationEmail
LINKARE_ADMIN_KEY=$plainAdminKey
LINKARE_BILLING_ACCOUNT_SLUG=$accountSlug
WOMPI_REQUIRE_AUTH=false
"@ | Set-Content -LiteralPath $secretsFile -Encoding utf8

Push-Location (Split-Path -Parent $root)
try {
  npx supabase@latest login
  npx supabase@latest link --project-ref $ProjectRef
  npx supabase@latest secrets set --env-file $secretsFile --project-ref $ProjectRef
  npx supabase@latest functions deploy wompi-app-info --project-ref $ProjectRef --no-verify-jwt
  npx supabase@latest functions deploy linkare-billing-summary --project-ref $ProjectRef --no-verify-jwt
  npx supabase@latest functions deploy linkare-billing-admin --project-ref $ProjectRef --no-verify-jwt
  npx supabase@latest functions deploy linkare-create-payment-link --project-ref $ProjectRef --no-verify-jwt
  npx supabase@latest functions deploy wompi-webhook --project-ref $ProjectRef --no-verify-jwt
  Write-Host "Linkare + Wompi Edge Functions desplegadas correctamente." -ForegroundColor Green
  Write-Host "Webhook Wompi:" -ForegroundColor Cyan
  Write-Host "https://$ProjectRef.supabase.co/functions/v1/wompi-webhook" -ForegroundColor Yellow
} finally {
  Pop-Location
  Remove-Item -LiteralPath $secretsFile -Force -ErrorAction SilentlyContinue
  $plainSecret = $null
  $plainAdminKey = $null
}
