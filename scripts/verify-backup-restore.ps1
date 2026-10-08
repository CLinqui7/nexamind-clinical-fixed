param(
  [Parameter(Mandatory = $true)][string]$EncryptedBackup,
  [Parameter(Mandatory = $true)][string]$Output,
  [Parameter(Mandatory = $true)][string]$Organization,
  [Parameter(Mandatory = $true)][string]$Owner,
  [string]$EnrichmentSourceZip,
  [string]$EnrichmentBatch,
  [string]$EnrichmentBackupSha,
  [string]$EnrichmentPlanSha
)

$ErrorActionPreference = 'Stop'
$backupPath = [System.IO.Path]::GetFullPath($EncryptedBackup)
if (-not (Test-Path -LiteralPath $backupPath)) { throw 'Encrypted backup not found.' }
$tempRoot = [System.IO.Path]::GetFullPath($env:TEMP)
$plainPath = Join-Path $tempRoot ('linkare-restore-' + [guid]::NewGuid().ToString('N') + '.json')
[byte[]]$encrypted = [System.IO.File]::ReadAllBytes($backupPath)
[byte[]]$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $encrypted,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
try {
  [System.IO.File]::WriteAllBytes($plainPath, $plain)
  $verifyArgs = @('scripts/verify-backup-restore.mjs','--backup',$plainPath,'--output',$Output,'--organization',$Organization,'--owner',$Owner)
  if ($EnrichmentSourceZip) {
    $verifyArgs += @('--enrichment-source-zip',$EnrichmentSourceZip,'--enrichment-batch',$EnrichmentBatch,'--enrichment-backup-sha',$EnrichmentBackupSha,'--enrichment-plan-sha',$EnrichmentPlanSha)
  }
  node @verifyArgs
  if ($LASTEXITCODE -ne 0) { throw 'Backup restore verification failed.' }
} finally {
  [Array]::Clear($plain, 0, $plain.Length)
  [Array]::Clear($encrypted, 0, $encrypted.Length)
  $resolvedPlain = [System.IO.Path]::GetFullPath($plainPath)
  if ($resolvedPlain.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedPlain -Force -ErrorAction SilentlyContinue
  }
}
