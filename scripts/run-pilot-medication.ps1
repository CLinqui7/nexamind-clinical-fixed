param(
  [Parameter(Mandatory = $true)][ValidateSet('dry-run','apply','verify')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$SourceZip,
  [Parameter(Mandatory = $true)][string]$Organization,
  [Parameter(Mandatory = $true)][string]$Batch,
  [Parameter(Mandatory = $true)][string]$Output,
  [Parameter(Mandatory = $true)][string]$BackupSha,
  [Parameter(Mandatory = $true)][string]$PlanSha,
  [string]$RestoreReport
)

$ErrorActionPreference='Stop'
if((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'fvucylgrqgxjqabacnlt'){
  throw 'Unexpected linked Supabase project.'
}
if($Mode -eq 'apply' -and -not $RestoreReport){throw 'Restore report required for apply.'}
if($Mode -ne 'dry-run'){
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
}
try {
  if($Mode -ne 'dry-run'){
    $env:PGHOST=Read-TemporaryConnectionValue 'PGHOST'
    $env:PGPORT=Read-TemporaryConnectionValue 'PGPORT'
    $env:PGUSER=Read-TemporaryConnectionValue 'PGUSER'
    $env:PGPASSWORD=Read-TemporaryConnectionValue 'PGPASSWORD'
    $env:PGDATABASE=Read-TemporaryConnectionValue 'PGDATABASE'
    $env:PGSSLMODE='require'
  }
  $args=@('scripts/legacy-medication-enrichment.mjs','--mode',$Mode,'--source-zip',$SourceZip,
    '--organization',$Organization,'--source','foxpro-linkare-pilot50','--cohort-size','50',
    '--batch',$Batch,'--backup-sha',$BackupSha,'--plan-sha',$PlanSha,'--output',$Output,
    '--chunk-size','25','--pause-ms','100')
  if($RestoreReport){$args+=@('--restore-report',$RestoreReport)}
  node @args
  if($LASTEXITCODE -ne 0){throw "Pilot medication $Mode failed."}
} finally {
  foreach($name in @('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE')){
    Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
  }
}
