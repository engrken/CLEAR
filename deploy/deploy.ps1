# Ships the committed code (HEAD) to the VPS and runs deploy/update.sh there.
# Usage (from the project root):  powershell -File deploy\deploy.ps1
# Uncommitted changes are NOT deployed.
param([string]$Target = "myvps")
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$ssh = "$env:WINDIR\System32\OpenSSH\ssh.exe"
$scp = "$env:WINDIR\System32\OpenSSH\scp.exe"

# Only the web app: the Expo app, docs and editor settings stay out.
$exclude = @(":(exclude)mobile", ":(exclude).claude", ":(exclude)*.docx", ":(exclude)*.jpg", ":(exclude)seed-excel.js",
             ":(exclude)*.xlsx", ":(exclude)*.zip", ":(exclude)*.bak", ":(exclude)*.log", ":(exclude).clear-placeholder-backup",
             ":(exclude)change-report.json", ":(exclude)add-department-arg.sh")

$dirty = git status --porcelain -- . @exclude
if ($dirty) {
  Write-Warning "These uncommitted changes will NOT be deployed (only HEAD is):"
  $dirty | ForEach-Object { Write-Host "  $_" }
}

$sha = (git rev-parse --short HEAD).Trim()
$tar = Join-Path $env:TEMP "clear-sys-$sha.tar"
git archive --format=tar -o $tar HEAD -- . @exclude
if ($LASTEXITCODE) { throw "git archive failed" }

try {
  & $scp -q $tar "${Target}:/tmp/clear-sys.tar"
  if ($LASTEXITCODE) { throw "scp failed" }

  # Replace the source folders so deleted files don't linger; node_modules, .next
  # and .env.production are kept.
  $remote = "set -e; mkdir -p ~/clear-sys; cd ~/clear-sys; rm -rf app lib prisma public types deploy; " +
            "tar -xf /tmp/clear-sys.tar; rm -f /tmp/clear-sys.tar; echo $sha > REVISION; bash deploy/update.sh"
  & $ssh $Target $remote
  if ($LASTEXITCODE) { throw "update.sh failed on $Target (exit $LASTEXITCODE)" }
  Write-Host "Deployed $sha to $Target."
} finally {
  Remove-Item $tar -ErrorAction SilentlyContinue
}
