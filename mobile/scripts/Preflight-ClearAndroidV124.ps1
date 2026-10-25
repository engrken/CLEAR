# Local preflight only: never signs, publishes or modifies production data.
[CmdletBinding()]
param([switch]$InstallDependencies)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$mobile=Join-Path $root 'mobile'
$app=Get-Content -LiteralPath (Join-Path $mobile 'app.json') -Raw | ConvertFrom-Json
$eas=Get-Content -LiteralPath (Join-Path $mobile 'eas.json') -Raw | ConvertFrom-Json
if ($app.expo.version -ne '1.2.4' -or $app.expo.android.versionCode -ne 14) { throw 'Expected v1.2.4/code14 after internal 1.2.3 used code13; verify code14 unused in Play.' }
if ($app.expo.android.package -ne 'com.rupertbulquerin.clear' -or $app.expo.owner -ne 'rupert2133s-team') { throw 'Android/Expo identity mismatch.' }
if ($eas.build.production.env.EXPO_PUBLIC_API_URL -ne 'https://clearsys.vercel.app/api/mobile' -or $eas.build.production.android.buildType -ne 'app-bundle') { throw 'Production API/AAB profile mismatch.' }
& node (Join-Path $mobile 'scripts\verify-live-viewer.mjs') --release
if ($LASTEXITCODE -ne 0) { throw 'Approved release artwork / financial safety check failed.' }
Push-Location $mobile
try {
  if ($InstallDependencies) {
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  }
  if (-not (Test-Path '.\node_modules')) { throw 'Install dependencies using -InstallDependencies.' }
  & npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw 'Android TypeScript validation failed.' }
} finally { Pop-Location }
Write-Host 'PASS: v1.2.4/code14, full-resolution approved icon, Production API, read-only write gates, TypeScript.'
Write-Host 'Next: verify code14 unused on all Play tracks, compile in short-path disposable workspace, sign with existing Play Upload key and run Verify-ClearAndroidAAB.ps1.'
