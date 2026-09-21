param([string]$ProjectRef='fvucylgrqgxjqabacnlt',[string]$AppUrl='https://nexamind-clinical.vercel.app')
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
& npx --yes supabase db query --project-ref $ProjectRef --linked --file (Join-Path $repo 'supabase/POSTCHECK-FREE-ACCESS.sql') --output json
if ($LASTEXITCODE -ne 0) { throw 'Falló el postcheck SQL.' }
$origins=@($AppUrl,'https://nexamind-clinical-git-main-clinqui7s-projects.vercel.app','http://localhost:4173','http://127.0.0.1:4173')
foreach ($origin in $origins) {
  $response=Invoke-WebRequest -Uri "https://$ProjectRef.supabase.co/functions/v1/linkare-team" -Method Options -Headers @{Origin=$origin;'Access-Control-Request-Method'='POST';'Access-Control-Request-Headers'='authorization,apikey,content-type'}
  if ($response.StatusCode -ne 200 -or [string]$response.Headers['Access-Control-Allow-Origin'] -ne $origin) { throw "CORS no válido para $origin" }
  Write-Output "OPTIONS_OK $origin"
}
if ($env:LINKARE_VERIFY_TOKEN -and $env:SUPABASE_ANON_KEY -and $env:LINKARE_VERIFY_ORG) {
  foreach ($function in @('linkare-team','wompi-app-info','calendar-status','reminder-provider-status')) {
    $response=Invoke-RestMethod -Uri "https://$ProjectRef.supabase.co/functions/v1/$function" -Method Post -Headers @{Authorization="Bearer $env:LINKARE_VERIFY_TOKEN";apikey=$env:SUPABASE_ANON_KEY} -ContentType 'application/json' -Body (@{organizationId=$env:LINKARE_VERIFY_ORG;action='list'}|ConvertTo-Json)
    if ($response.ok -ne $true) { throw "CANARY_FAILED $function" }
    Write-Output "CANARY_OK $function"
  }
} else { Write-Output 'AUTH_CANARY_NOT_RUN: proporcione LINKARE_VERIFY_TOKEN, LINKARE_VERIFY_ORG y SUPABASE_ANON_KEY mediante entorno.' }
$site=Invoke-WebRequest -Uri $AppUrl
if ($site.StatusCode -ne 200) { throw 'El frontend no respondió HTTP 200.' }
Write-Output "FRONTEND_HTTP_OK $AppUrl"
