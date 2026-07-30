param(
  [ValidateSet('mainnet', 'gatekeeper_beta')]
  [string]$HeliusRpcEndpointMode = 'gatekeeper_beta',
  [string]$SecretDirectory = (Join-Path $env:LOCALAPPDATA 'memecoin-ca-data-layer\secrets')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$secretNames = @('GMGN_API_KEY', 'HELIUS_API_KEY')
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

  Push-Location $repoRoot
  try {
    & npm.cmd run solana:daily:new-token-analysis
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if ($exitCode -ne 0) {
    exit $exitCode
  }
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
