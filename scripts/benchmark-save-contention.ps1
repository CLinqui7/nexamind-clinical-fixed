param(
  [Parameter(Mandatory = $true)][string]$Organization,
  [Parameter(Mandatory = $true)][string]$User,
  [ValidateSet('patient', 'appointment', 'appointment-existing')][string]$Scenario = 'patient',
  [string]$Calendar,
  [int]$Concurrency = 20,
  [int]$HoldMs = 150
)

$ErrorActionPreference = 'Stop'
$clientDir = Join-Path $env:TEMP ('linkare-contention-pg-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $clientDir | Out-Null
try {
  npm install --prefix $clientDir pg@8.16.3 --no-audit --no-fund | Out-Null
  $dumpDryRun = npx --yes supabase@2.115.0 db dump --linked --dry-run 2>&1 | Out-String
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
  $benchmarkArgs = @('scripts/benchmark-save-contention.cjs', '--organization', $Organization, '--user', $User, '--scenario', $Scenario, '--concurrency', $Concurrency, '--hold-ms', $HoldMs)
  if ($Calendar) { $benchmarkArgs += @('--calendar', $Calendar) }
  & node @benchmarkArgs
  if ($LASTEXITCODE -ne 0) { throw 'Contention benchmark failed.' }
} finally {
  $resolvedClient = [System.IO.Path]::GetFullPath($clientDir)
  $resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP)
  if ($resolvedClient.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedClient -Recurse -Force -ErrorAction SilentlyContinue
  }
}
