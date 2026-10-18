# Writes ~/clear-sys/.env.production on the VPS from your local production env backup.
# Usage (from the project root):  powershell -File deploy\push-env.ps1 -Domain clear.example.com
# Only the keys the app reads are copied; nothing is printed.
param(
  [Parameter(Mandatory = $true)][string]$Domain,
  [string]$Target = "myvps",
  [string]$Source = ".env.production.backup"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$keys = @(
  "DATABASE_URL", "DIRECT_URL", "AUTH_SECRET", "SUPER_ADMIN_EMAIL",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "MAIL_FROM",
  "BLOB_READ_WRITE_TOKEN", "CLEARANCE_SALT",
  "DEMO_REVIEWER_EMAIL", "DEMO_REVIEWER_CODE"
)

$values = @{}
foreach ($line in Get-Content $Source) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$' -and $keys -contains $Matches[1]) {
    $values[$Matches[1]] = $Matches[2].Trim()
  }
}
foreach ($required in @("DATABASE_URL", "AUTH_SECRET", "SUPER_ADMIN_EMAIL", "SMTP_USER", "SMTP_PASSWORD")) {
  if (-not $values[$required]) { throw "$required is missing from $Source" }
}
if ($values["DATABASE_URL"] -notmatch "neon\.tech") { throw "DATABASE_URL in $Source is not the Neon production database" }

$out = @("# Written by deploy/push-env.ps1 on $(Get-Date -Format s)")
foreach ($k in $keys) { if ($values[$k]) { $out += "$k=$($values[$k])" } }
$out += "AUTH_URL=https://$Domain"
$out += "AUTH_TRUST_HOST=true"

$tmp = Join-Path $env:TEMP "clear-env-$([guid]::NewGuid().ToString('N'))"
try {
  # LF line endings, no BOM
  [IO.File]::WriteAllText($tmp, (($out -join "`n") + "`n"), (New-Object Text.UTF8Encoding $false))
  & "$env:WINDIR\System32\OpenSSH\ssh.exe" $Target "mkdir -p ~/clear-sys && touch ~/clear-sys/.env.production && chmod 600 ~/clear-sys/.env.production"
  if ($LASTEXITCODE) { throw "ssh failed" }
  & "$env:WINDIR\System32\OpenSSH\scp.exe" -q $tmp "${Target}:clear-sys/.env.production"
  if ($LASTEXITCODE) { throw "scp failed" }
  Write-Host "Wrote ~/clear-sys/.env.production on $Target ($($out.Count - 1) keys, AUTH_URL=https://$Domain)."
} finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
}
