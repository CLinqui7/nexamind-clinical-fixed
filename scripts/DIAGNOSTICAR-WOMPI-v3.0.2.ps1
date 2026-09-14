param(
  [string]$Project = 'S:\Usuarios\Carlos\carlo\linkare-recuperado-20260908-125127',
  [string]$Email = 'linquicarloss@gmail.com',
  [string]$OrganizationId = 'f5cf65b6-284d-4454-9285-4035b90f7db7',
  [ValidateSet('monthly','semiannual','annual')][string]$Plan = 'annual'
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $Project
$envFile = Join-Path $Project '.env.local'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Falta .env.local.' }
$vars = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { $vars[$matches[1].Trim()] = $matches[2].Trim() }
}
$url = $vars['VITE_SUPABASE_URL']
$key = $vars['VITE_SUPABASE_PUBLISHABLE_KEY']
if (-not $key) { $key = $vars['VITE_SUPABASE_ANON_KEY'] }
if (-not $url -or -not $key) { throw 'Faltan VITE_SUPABASE_URL o la clave publica en .env.local.' }
$secure = Read-Host "Password de $Email" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$authBody = @{ email = $Email; password = $password } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" -Headers @{ apikey = $key } -ContentType 'application/json' -Body $authBody
if (-not $session.access_token) { throw 'Supabase no devolvio un access token.' }
Write-Host 'AUTH_OK' -ForegroundColor Green
$headers = @{ apikey = $key; Authorization = "Bearer $($session.access_token)" }
$statusBody = @{ organizationId = $OrganizationId } | ConvertTo-Json
$status = Invoke-RestMethod -Method Post -Uri "$url/functions/v1/wompi-app-info" -Headers $headers -ContentType 'application/json' -Body $statusBody
$status | ConvertTo-Json -Depth 8
if (-not $status.ok) { throw 'Wompi app status fallo.' }
Write-Host 'WOMPI_STATUS_OK' -ForegroundColor Green
$confirm = Read-Host "Escriba CREAR-$($Plan.ToUpper()) para crear un enlace real de Wompi"
if ($confirm -cne "CREAR-$($Plan.ToUpper())") { Write-Host 'No se creo ningun cobro.'; exit 0 }
$checkoutBody = @{ organizationId = $OrganizationId; planCode = $Plan } | ConvertTo-Json
$checkout = Invoke-RestMethod -Method Post -Uri "$url/functions/v1/wompi-create-link" -Headers $headers -ContentType 'application/json' -Body $checkoutBody
$checkout | ConvertTo-Json -Depth 8
if (-not $checkout.ok -or -not $checkout.payment.url) { throw 'No se genero el enlace de pago.' }
Write-Host 'CHECKOUT_OK' -ForegroundColor Green
Write-Host $checkout.payment.url -ForegroundColor Cyan
Start-Process $checkout.payment.url
