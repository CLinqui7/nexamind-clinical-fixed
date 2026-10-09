param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = 'Stop'
$resolvedDestination = [System.IO.Path]::GetFullPath($Destination)
$resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP)
if (-not $resolvedDestination.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Backup destination must be inside the current user temporary directory.'
}
New-Item -ItemType Directory -Force -Path $resolvedDestination | Out-Null

$clientDir = Join-Path $resolvedDestination 'pg-client'
New-Item -ItemType Directory -Force -Path $clientDir | Out-Null
npm install --prefix $clientDir pg@8.16.3 --no-audit --no-fund | Out-Null

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $dumpDryRun = npx --yes supabase@2.115.0 db dump --linked --dry-run 2>&1 | Out-String
  $dumpExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}
if ($dumpExitCode -ne 0) { throw 'Unable to obtain temporary database connection.' }
function Read-TemporaryConnectionValue([string]$Name) {
  $match = [regex]::Match($dumpDryRun, "(?m)^export $Name=(.+)$")
  if (-not $match.Success) { throw "Missing $Name in the temporary database connection." }
  return $match.Groups[1].Value.Trim().Trim('"')
}

$env:PGHOST = Read-TemporaryConnectionValue 'PGHOST'
$env:PGPORT = Read-TemporaryConnectionValue 'PGPORT'
$env:PGUSER = Read-TemporaryConnectionValue 'PGUSER'
$env:PGPASSWORD = Read-TemporaryConnectionValue 'PGPASSWORD'
$env:PGDATABASE = Read-TemporaryConnectionValue 'PGDATABASE'
$env:PGSSLMODE = 'require'
$env:NODE_PATH = Join-Path $clientDir 'node_modules'

$plainPath = Join-Path $resolvedDestination 'production-logical-backup.json'
$encryptedPath = Join-Path $resolvedDestination 'production-logical-backup.dpapi'
try {
  node scripts/backup-production-database.cjs $plainPath
  if ($LASTEXITCODE -ne 0) { throw 'Logical backup failed.' }

  [byte[]]$plain = [System.IO.File]::ReadAllBytes($plainPath)
  $encrypted = [System.Security.Cryptography.ProtectedData]::Protect(
    $plain,
    $null,
    [System.Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  [System.IO.File]::WriteAllBytes($encryptedPath, $encrypted)
} finally {
  if ($plain) { [Array]::Clear($plain, 0, $plain.Length) }
  if ($encrypted) { [Array]::Clear($encrypted, 0, $encrypted.Length) }
  if (Test-Path -LiteralPath $plainPath) { Remove-Item -LiteralPath $plainPath -Force }
}

$resolvedClient = [System.IO.Path]::GetFullPath($clientDir)
if (-not $resolvedClient.StartsWith($resolvedDestination, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Unsafe client cleanup path.'
}
Remove-Item -LiteralPath $resolvedClient -Recurse -Force

$file = Get-Item -LiteralPath $encryptedPath
[pscustomobject]@{
  EncryptedBackup = $file.FullName
  EncryptedBytes = $file.Length
  EncryptedSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $encryptedPath).Hash.ToLowerInvariant()
}
