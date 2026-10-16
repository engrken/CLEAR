# Switches CLEAR's outgoing mail to Resend (SMTP) and applies it on the VPS.
# Usage (from the project root):  powershell -File deploy\set-resend-smtp.ps1
# Prompts for a Resend API key (input hidden), updates .env.production.backup,
# re-pushes ~/clear-sys/.env.production and restarts the app. Prints no secrets.
param(
  [string]$Domain = "clear.rupertbulquerin.com",
  [string]$From = "CLEAR System <noreply@clear.rupertbulquerin.com>",
  [string]$Target = "myvps",
  [string]$Backup = ".env.production.backup"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$secure = Read-Host "Resend API key (re_...)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ($key -notmatch '^re_[A-Za-z0-9_]{10,}$') { throw "That doesn't look like a Resend API key (expected re_...)." }

$settings = [ordered]@{
  SMTP_HOST     = "smtp.resend.com"
  SMTP_PORT     = "465"
  SMTP_USER     = "resend"
  SMTP_PASSWORD = $key
  MAIL_FROM     = "`"$From`""
}

# Rewrite those keys in the local production backup (keeps everything else).
$lines = [Collections.Generic.List[string]](Get-Content $Backup)
foreach ($k in $settings.Keys) {
  $idx = -1
  for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^\s*#?\s*$k\s*=") { if ($lines[$i] -notmatch '^\s*#') { $idx = $i; break } } }
  $entry = "$k=$($settings[$k])"
  if ($idx -ge 0) { $lines[$idx] = $entry } else { $lines.Add($entry) }
}
[IO.File]::WriteAllText((Resolve-Path $Backup), (($lines -join "`r`n") + "`r`n"), (New-Object Text.UTF8Encoding $false))
Write-Host "Updated SMTP settings in $Backup."

& powershell -NoProfile -ExecutionPolicy Bypass -File deploy\push-env.ps1 -Domain $Domain -Target $Target -Source $Backup
if ($LASTEXITCODE) { throw "push-env failed" }

& "$env:WINDIR\System32\OpenSSH\ssh.exe" $Target "pm2 restart clear-sys --update-env >/dev/null && sleep 3 && curl -s -o /dev/null -w 'clear-sys restarted, local / -> %{http_code}\n' http://127.0.0.1:3040/"
if ($LASTEXITCODE) { throw "restart failed" }
Write-Host "Mail now goes out via Resend as $From."
