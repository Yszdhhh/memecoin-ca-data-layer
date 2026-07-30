param(
  # gatekeeper_beta is the default because some operator networks resolve
  # mainnet.helius-rpc.com to 127.0.0.1; mainnet remains an explicit opt-in.
  [ValidateSet('mainnet', 'gatekeeper_beta')]
  [string]$HeliusRpcEndpointMode = 'gatekeeper_beta',
  [string]$SecretDirectory = (Join-Path $env:LOCALAPPDATA 'memecoin-ca-data-layer\secrets'),
  [string]$Manifest = 'harness/inputs/SOL-CA-REAL-DATA-CLEANING-PILOT-001/input-manifest.json',
  [string]$Out = 'harness/reports/SOL-CA-REAL-DATA-CLEANING-PILOT-001',
  [int]$MaxPages = 50,
  [int]$RequestBudget = 600,
  [switch]$ShowZeroBalance
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$secretNames = @('HELIUS_API_KEY')
$allocated = New-Object System.Collections.Generic.List[System.IntPtr]
$exitCode = 1

function Read-DpapiSecret {
  param([Parameter(Mandatory = $true)][string]$Name)

  $path = Join-Path $SecretDirectory "$Name.dpapi"
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "$Name is not configured. Run scripts\configure-solana-daily-credentials.ps1 as the same Windows user."
  }

  $encrypted = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8).Trim()
  if (-not $encrypted) {
    throw "$Name encrypted file is empty."
  }

  $secure = ConvertTo-SecureString -String $encrypted
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $allocated.Add($pointer)
  return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
}

try {
  foreach ($name in $secretNames) {
    [Environment]::SetEnvironmentVariable($name, (Read-DpapiSecret -Name $name), 'Process')
  }
  [Environment]::SetEnvironmentVariable('HELIUS_RPC_ENDPOINT_MODE', $HeliusRpcEndpointMode, 'Process')

  # Local proxy + poisoned mainnet DNS previously caused ECONNREFUSED 127.0.0.1:443.
  # Clear process proxy vars for this Node run; do not print values.
  foreach ($proxyName in @('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy')) {
    [Environment]::SetEnvironmentVariable($proxyName, $null, 'Process')
  }

  Push-Location $repoRoot
  try {
    $cliArgs = @(
      'tsx', 'src/cli/run-solana-ca-real-data-cleaning-pilot.ts',
      '--manifest', $Manifest,
      '--out', $Out,
      '--max-pages', "$MaxPages",
      '--request-budget', "$RequestBudget"
    )
    if ($ShowZeroBalance) {
      $cliArgs += '--show-zero-balance'
    }
    & npx.cmd @cliArgs
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  exit $exitCode
} catch {
  Write-Output (@{ status = 'RUNTIME_CREDENTIAL_UNAVAILABLE'; warnings = @($_.Exception.Message) } | ConvertTo-Json -Compress)
  exit 2
} finally {
  foreach ($name in $secretNames) {
    [Environment]::SetEnvironmentVariable($name, $null, 'Process')
  }
  [Environment]::SetEnvironmentVariable('HELIUS_RPC_ENDPOINT_MODE', $null, 'Process')
  foreach ($pointer in $allocated) {
    if ($pointer -ne [System.IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
  }
}
