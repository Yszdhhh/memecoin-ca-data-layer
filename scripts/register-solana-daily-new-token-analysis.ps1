param(
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
  [string]$At = '09:00',
  [string]$TaskName = 'Memecoin CA Daily Solana Analysis',
  [ValidateSet('mainnet', 'gatekeeper_beta')]
  [string]$HeliusRpcEndpointMode = 'gatekeeper_beta',
  [string]$SecretDirectory = (Join-Path $env:LOCALAPPDATA 'memecoin-ca-data-layer\secrets')
)

$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot 'run-solana-daily-new-token-analysis.ps1'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
  throw 'Daily analysis runner is unavailable.'
}
foreach ($name in @('GMGN_API_KEY', 'HELIUS_API_KEY')) {
  if (-not (Test-Path -LiteralPath (Join-Path $SecretDirectory "$name.dpapi") -PathType Leaf)) {
    throw "$name is not configured. Run scripts\set-solana-daily-secrets.ps1 first."
  }
}

$today = Get-Date
$parts = $At.Split(':')
$runAt = Get-Date -Year $today.Year -Month $today.Month -Day $today.Day -Hour ([int]$parts[0]) -Minute ([int]$parts[1]) -Second 0
$quotedRunner = '"' + $runner.Replace('"', '""') + '"'
$quotedSecrets = '"' + $SecretDirectory.Replace('"', '""') + '"'
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $quotedRunner -HeliusRpcEndpointMode $HeliusRpcEndpointMode -SecretDirectory $quotedSecrets"

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At $runAt
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Bounded Solana-only daily discovery with GMGN and read-only Helius analysis.' -Force | Out-Null
Write-Host "Scheduled task '$TaskName' registered for $At daily while this Windows user is logged on."
