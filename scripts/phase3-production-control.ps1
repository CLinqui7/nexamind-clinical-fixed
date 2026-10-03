param(
  [Parameter(Mandatory = $true)][ValidateSet('preflight', 'collisions', 'progress', 'backfill', 'verify')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$Output,
  [string]$Email,
  [string]$Organization,
  [string]$Batch,
  [string]$BackupSha,
  [string]$PlanSha,
  [string]$Baseline,
  [string]$Manifest
)

$ErrorActionPreference = 'Stop'
$clientDir = Join-Path $env:TEMP ('linkare-phase3-pg-' + [guid]::NewGuid().ToString('N'))
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

  $arguments = @('scripts/phase3-production-control.cjs', '--mode', $Mode, '--output', $Output)
  if ($Email) { $arguments += @('--email', $Email) }
  if ($Organization) { $arguments += @('--organization', $Organization) }
  if ($Batch) { $arguments += @('--batch', $Batch) }
  if ($BackupSha) { $arguments += @('--backup-sha', $BackupSha) }
  if ($PlanSha) { $arguments += @('--plan-sha', $PlanSha) }
  if ($Baseline) { $arguments += @('--baseline', $Baseline) }
  if ($Manifest) { $arguments += @('--manifest', $Manifest) }
  & node @arguments
  if ($LASTEXITCODE -ne 0) { throw "Phase 3 control failed in mode $Mode." }
} finally {
  $resolvedClient = [System.IO.Path]::GetFullPath($clientDir)
  $resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP)
  if ($resolvedClient.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedClient -Recurse -Force -ErrorAction SilentlyContinue
  }
}
