param(
 [Parameter(Mandatory=$true)][string]$Project,
 [string]$ProjectRef = 'fvucylgrqgxjqabacnlt',
 [string]$PublicUrl = 'https://nexamind-clinical.vercel.app'
)
$ErrorActionPreference = 'Stop'
if ($ProjectRef -notmatch '^[a-z]{20}$') { throw 'Use the 20-letter Supabase project ref, not its name.' }
if (-not (Test-Path -LiteralPath (Join-Path $Project 'supabase\config.toml'))) { throw 'Missing project configuration.' }
if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) { throw 'Node/npm is required. Reopen PowerShell after installing Node.' }
$uri = [uri]$PublicUrl
if ($uri.Scheme -ne 'https' -or -not $uri.Host) { throw 'PublicUrl must be the HTTPS production URL.' }
$answer = Read-Host 'After backup, staging and v3 SQL review, type BACKEND-V3 to continue'
if ($answer -cne 'BACKEND-V3') { throw 'Cancelled. No deployment performed.' }
Push-Location -LiteralPath $Project
try {
 & npm.cmd run check
 if ($LASTEXITCODE -ne 0) { throw 'Local validation failed. Nothing will be deployed.' }
 & npx.cmd --yes supabase@latest projects list
 if ($LASTEXITCODE -ne 0) { throw 'Supabase login is required. Run: npx --yes supabase@latest login' }
 # Public origin only. Existing API secrets are not read or changed.
 $origin = $uri.GetLeftPart([System.UriPartial]::Authority)
 & npx.cmd --yes supabase@latest secrets set --project-ref $ProjectRef "APP_PUBLIC_URL=$origin" "CORS_ORIGINS=$origin,http://localhost:4173,http://127.0.0.1:4173"
 if ($LASTEXITCODE -ne 0) { throw 'Could not configure public origin.' }
 $functions = @('linkare-team','wompi-app-info','wompi-create-link','wompi-webhook','send-reminder','reminder-provider-status','reminder-dispatch','google-calendar-auth-url','google-calendar-callback','google-calendar-sync','calendar-status','calendar-feed-token','calendar-feed','linkare-bootstrap','linkare-billing-admin','linkare-billing-summary','linkare-create-payment-link')
 foreach ($name in $functions) {
  Write-Host "Deploying $name..."
  & npx.cmd --yes supabase@latest functions deploy $name --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw "Deployment stopped at $name. Earlier deployments were not rolled back. Keep the maintenance window open." }
 }
 Write-Host 'FUNCTIONS DEPLOYED. This does not prove email delivery or a completed payment.' -ForegroundColor Green
 Write-Host "Webhook: https://$ProjectRef.supabase.co/functions/v1/wompi-webhook"
 Write-Host 'Run the acceptance checks in docs/DESPLIEGUE-v3.md before publishing frontend.'
} finally { Pop-Location }
