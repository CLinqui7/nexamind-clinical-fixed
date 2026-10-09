param(
  [Parameter(Mandatory = $true)][string]$EncryptedBackup,
  [Parameter(Mandatory = $true)][string]$SourceOrganization,
  [Parameter(Mandatory = $true)][string]$DestinationOrganization,
  [Parameter(Mandatory = $true)][string]$Batch
)

$ErrorActionPreference='Stop'
$temporaryRoot=[System.IO.Path]::GetFullPath($env:TEMP)
$plainPath=Join-Path $temporaryRoot ('linkare-baseline-' + [guid]::NewGuid().ToString('N') + '.json')
[byte[]]$encrypted=[System.IO.File]::ReadAllBytes([System.IO.Path]::GetFullPath($EncryptedBackup))
[byte[]]$plain=[System.Security.Cryptography.ProtectedData]::Unprotect($encrypted,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
try {
  [System.IO.File]::WriteAllBytes($plainPath,$plain)
  $previousErrorActionPreference=$ErrorActionPreference
  $ErrorActionPreference='Continue'
  try {
    $connectionText=npx --yes supabase@2.115.0 db dump --linked --dry-run 2>&1 | Out-String
    $connectionExitCode=$LASTEXITCODE
  } finally { $ErrorActionPreference=$previousErrorActionPreference }
  if($connectionExitCode -ne 0){throw 'Temporary database connection unavailable.'}
  function Read-TemporaryConnectionValue([string]$name){
    $match=[regex]::Match($connectionText,"(?m)^export $name=(.+)$")
    if(-not $match.Success){throw "Missing $name"}
    return $match.Groups[1].Value.Trim().Trim('"')
  }
  $env:PGHOST=Read-TemporaryConnectionValue 'PGHOST'
  $env:PGPORT=Read-TemporaryConnectionValue 'PGPORT'
  $env:PGUSER=Read-TemporaryConnectionValue 'PGUSER'
  $env:PGPASSWORD=Read-TemporaryConnectionValue 'PGPASSWORD'
  $env:PGDATABASE=Read-TemporaryConnectionValue 'PGDATABASE'
  $env:PGSSLMODE='require'
  node scripts/verify-pilot-baseline.cjs $plainPath $SourceOrganization $DestinationOrganization $Batch
  if($LASTEXITCODE -ne 0){throw 'Existing patient baseline changed.'}
} finally {
  [Array]::Clear($plain,0,$plain.Length)
  [Array]::Clear($encrypted,0,$encrypted.Length)
  $resolvedPlain=[System.IO.Path]::GetFullPath($plainPath)
  if($resolvedPlain.StartsWith($temporaryRoot,[System.StringComparison]::OrdinalIgnoreCase)){
    Remove-Item -LiteralPath $resolvedPlain -Force -ErrorAction SilentlyContinue
  }
  foreach($name in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE')){
    Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  }
}
