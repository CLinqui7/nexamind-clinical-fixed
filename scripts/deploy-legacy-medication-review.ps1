param(
  [Parameter(Mandatory=$true)][ValidateSet('apply','verify')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$PreflightReport,
  [string]$RestoreReport
)
$ErrorActionPreference='Stop'
if((Get-Content -LiteralPath 'supabase/.temp/project-ref' -Raw).Trim() -ne 'fvucylgrqgxjqabacnlt'){throw 'Unexpected linked Supabase project.'}
if($Mode -eq 'apply' -and -not $RestoreReport){throw 'A current isolated restore report is required.'}
$connection=npm exec supabase -- db dump --linked --dry-run 2>&1 | Out-String
if($LASTEXITCODE -ne 0){throw 'Could not obtain the linked database connection.'}
$names=@('PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE')
try{
  foreach($name in $names){
    $match=[regex]::Match($connection,"(?m)^export $name=(.+)$")
    if(-not $match.Success){throw "Temporary database setting $name is missing."}
    [Environment]::SetEnvironmentVariable($name,$match.Groups[1].Value.Trim().Trim('"'),'Process')
  }
  [Environment]::SetEnvironmentVariable('PGSSLMODE','require','Process')
  $arguments=@('scripts/deploy-legacy-medication-review.cjs',$Mode,$PreflightReport)
  if($RestoreReport){$arguments+=$RestoreReport}
  & node @arguments
  if($LASTEXITCODE -ne 0){throw 'Historical medication review deployment or verification failed.'}
}finally{
  foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$null,'Process')}
  [Environment]::SetEnvironmentVariable('PGSSLMODE',$null,'Process')
  $connection=$null
}
