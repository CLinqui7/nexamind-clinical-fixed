param(
  [Parameter(Mandatory = $true)][ValidateSet('apply','verify')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$SourceZip,
  [Parameter(Mandatory = $true)][string]$Organization,
  [Parameter(Mandatory = $true)][string]$Batch,
  [Parameter(Mandatory = $true)][string]$BackupSha,
  [Parameter(Mandatory = $true)][string]$PlanSha,
  [Parameter(Mandatory = $true)][string]$Output,
  [string]$RestoreReport,
  [ValidateRange(10,100)][int]$ChunkSize = 50,
  [ValidateRange(100,5000)][int]$PauseMs = 250
)

$ErrorActionPreference = 'Stop'
if ($Mode -eq 'apply' -and -not $RestoreReport) { throw 'A current verified restore report is required.' }
$linkedProject = (Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim()
if ($linkedProject -ne 'fvucylgrqgxjqabacnlt') { throw 'Unexpected linked Supabase project.' }

# Supabase CLI supplies a short-lived connection. Keep the password only in
# process memory and never print the dry-run output or write it to disk.
$connection = npm exec supabase -- db dump --linked --dry-run 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw 'Could not obtain the linked database connection.' }
$names = @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE')
try {
  foreach ($name in $names) {
    $match = [regex]::Match($connection, "(?m)^export $name=(.+)$")
    if (-not $match.Success) { throw "Temporary database setting $name is missing." }
    [Environment]::SetEnvironmentVariable($name, $match.Groups[1].Value.Trim().Trim('"'), 'Process')
  }
  [Environment]::SetEnvironmentVariable('PGSSLMODE', 'require', 'Process')
  $arguments = @('scripts/legacy-medication-enrichment.mjs','--mode',$Mode,'--source-zip',$SourceZip,
    '--organization',$Organization,'--batch',$Batch,'--backup-sha',$BackupSha,'--plan-sha',$PlanSha,
    '--output',$Output,'--chunk-size',[string]$ChunkSize,'--pause-ms',[string]$PauseMs)
  if ($RestoreReport) { $arguments += @('--restore-report',$RestoreReport) }
  node @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Historical medication enrichment failed; resume with the same batch after review.' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
  [Environment]::SetEnvironmentVariable('PGSSLMODE', $null, 'Process')
  $connection = $null
}
