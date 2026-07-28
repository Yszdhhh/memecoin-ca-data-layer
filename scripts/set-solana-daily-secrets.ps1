param(
  [string]$SecretDirectory = (Join-Path $env:LOCALAPPDATA 'memecoin-ca-data-layer\secrets')
)

$ErrorActionPreference = 'Stop'

if (-not $env:LOCALAPPDATA) {
  throw 'LOCALAPPDATA is unavailable for the current Windows user.'
}

New-Item -ItemType Directory -Path $SecretDirectory -Force | Out-Null

function Save-DpapiSecret {
  param([Parameter(Mandatory = $true)][string]$Name)

  $secret = Read-Host "Enter $Name" -AsSecureString
  if ($secret.Length -eq 0) {
    throw "$Name cannot be empty."
  }

  $target = Join-Path $SecretDirectory "$Name.dpapi"
  $encrypted = ConvertFrom-SecureString -SecureString $secret
  [System.IO.File]::WriteAllText($target, $encrypted, [System.Text.UTF8Encoding]::new($false))
  Write-Host "$Name saved for the current Windows user."
}

Save-DpapiSecret -Name 'GMGN_API_KEY'
Save-DpapiSecret -Name 'HELIUS_API_KEY'
Write-Host "Encrypted secrets saved under $SecretDirectory. Secret values were not displayed."
