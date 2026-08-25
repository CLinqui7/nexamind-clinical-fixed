param(
  [string]$Project = "C:\Users\aleja\Downloads\NexaMind-Clinical-Completo-v1.2.0",
  [string]$ProjectRef = "fvucylgrqgxjqabacnlt",
  [string]$PublicUrl = "https://nexamind-clinical.vercel.app"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Project)) {
  throw "No se encontró el proyecto: $Project"
}
if ($ProjectRef -notmatch '^[a-z]{20}$') {
  throw "ProjectRef inválido. Debe contener exactamente 20 letras minúsculas."
}
if ($PublicUrl -notmatch '^https://') {
  throw "PublicUrl debe comenzar con https://"
}

Set-Location $Project

Write-Host "Vinculando Supabase..." -ForegroundColor Cyan
npx --yes supabase@latest link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "No se pudo vincular Supabase." }

Write-Host "Actualizando secretos no sensibles de entorno..." -ForegroundColor Cyan
npx --yes supabase@latest secrets set `
  APP_PUBLIC_URL="$($PublicUrl.TrimEnd('/'))" `
  WOMPI_REQUIRE_AUTH="true" `
  CLINIC_TIMEZONE="America/El_Salvador"
if ($LASTEXITCODE -ne 0) { throw "No se pudieron actualizar los secretos de entorno." }

$secured = @(
  'linkare-bootstrap',
  'wompi-create-link',
  'send-reminder',
  'reminder-provider-status',
  'google-calendar-auth-url',
  'google-calendar-sync',
  'calendar-status',
  'calendar-feed-token'
)
$public = @(
  'wompi-app-info',
  'wompi-webhook',
  'google-calendar-callback',
  'calendar-feed'
)

foreach ($name in $secured) {
  Write-Host "Desplegando $name..." -ForegroundColor DarkCyan
  npx --yes supabase@latest functions deploy $name --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "Falló el despliegue de $name." }
}
foreach ($name in $public) {
  Write-Host "Desplegando $name sin JWT de gateway..." -ForegroundColor DarkCyan
  npx --yes supabase@latest functions deploy $name --project-ref $ProjectRef --no-verify-jwt
  if ($LASTEXITCODE -ne 0) { throw "Falló el despliegue de $name." }
}

Write-Host "" 
Write-Host "LINKARE v2.0 EDGE FUNCTIONS DESPLEGADAS" -ForegroundColor Green
Write-Host "Wompi anual: listo para generar enlaces de US$400." -ForegroundColor Green
Write-Host "Webhook: https://$ProjectRef.supabase.co/functions/v1/wompi-webhook"
Write-Host "Google callback: https://$ProjectRef.supabase.co/functions/v1/google-calendar-callback"
Write-Host "Apple feed: se genera dentro de Linkare al conectar el calendario privado."
Write-Host "" 
Write-Host "Correo, SMS, WhatsApp y Google Calendar requieren sus secretos opcionales." -ForegroundColor Yellow
Write-Host "Revise: supabase\LINKARE-v2.0-SECRETS.example.txt" -ForegroundColor Yellow
