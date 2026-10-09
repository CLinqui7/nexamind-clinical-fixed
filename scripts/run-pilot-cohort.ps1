param(
  [Parameter(Mandatory = $true)][ValidateSet('apply','verify','rollback')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$SourceZip,
  [Parameter(Mandatory = $true)][string]$Organization,
  [Parameter(Mandatory = $true)][string]$Batch,
  [Parameter(Mandatory = $true)][string]$ApprovalFile,
  [Parameter(Mandatory = $true)][string]$Output,
  [Parameter(Mandatory = $true)][string]$BackupSha,
  [Parameter(Mandatory = $true)][string]$PlanSha
)

$ErrorActionPreference = 'Stop'
if ((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'fvucylgrqgxjqabacnlt') {
  throw 'Unexpected linked Supabase project.'
}
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  $connectionText = npx --yes supabase@2.115.0 db dump --linked --dry-run 2>&1 | Out-String
  $connectionExitCode = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorActionPreference
}
if ($connectionExitCode -ne 0) { throw 'Unable to obtain temporary database connection.' }
function Read-TemporaryConnectionValue([string]$Name) {
  $match = [regex]::Match($connectionText, "(?m)^export $Name=(.+)$")
  if (-not $match.Success) { throw "Missing $Name in temporary connection." }
  return $match.Groups[1].Value.Trim().Trim('"')
}
try {
  $env:PGHOST = Read-TemporaryConnectionValue 'PGHOST'
  $env:PGPORT = Read-TemporaryConnectionValue 'PGPORT'
  $env:PGUSER = Read-TemporaryConnectionValue 'PGUSER'
  $env:PGPASSWORD = Read-TemporaryConnectionValue 'PGPASSWORD'
  $env:PGDATABASE = Read-TemporaryConnectionValue 'PGDATABASE'
  $env:PGSSLMODE = 'require'
  $args = @('scripts/legacy-migration.mjs','--mode',$Mode,'--organization',$Organization,
    '--source','foxpro-linkare-pilot50','--batch',$Batch,'--backup-sha',$BackupSha,
    '--plan-sha',$PlanSha,'--approval-file',$ApprovalFile,'--output',$Output)
  if ($Mode -eq 'apply') {
    $args += @('--source-zip',$SourceZip,'--cohort-size','50','--chunk-size','25','--pause-ms','100')
  }
  node @args
  if ($LASTEXITCODE -ne 0) { throw "Pilot cohort $Mode failed." }
} finally {
  foreach ($name in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE')) {
    Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  }
}
