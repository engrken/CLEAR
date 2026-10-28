# Read-only release-preflight for the NEXT consolidated Play AAB.
# This intentionally fails while source is still the already-published 1.2.4/code14.
# It never downloads keys, builds, signs, pushes, or modifies Play/Production.
param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 999999)]
  [int]$HighestPlayVersionCode
)
$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path $mobileRoot 'app.json'
$app = (Get-Content -LiteralPath $appPath -Raw | ConvertFrom-Json).expo
$version = [string]$app.version
$code = [int]$app.android.versionCode
if ($app.android.package -ne 'com.rupertbulquerin.clear') {
  throw 'Package ID differs from the approved published CLEAR app.'
}
if ($version -eq '1.2.4' -or $code -le $HighestPlayVersionCode) {
  throw "NOT RELEASE READY: source is $version/code$code and latest Play code is $HighestPlayVersionCode. Confirm next unused code in ALL Play tracks, bump app.json, and reconcile old v1.2.4 scripts/tests before signing."
}
if ($env:EXPO_PUBLIC_API_URL -and $env:EXPO_PUBLIC_API_URL -ne 'https://clearsys.vercel.app/api/mobile') {
  throw 'Release endpoint must match approved production API.'
}
if ($env:EXPO_PUBLIC_API_MODE -eq 'mock' -or $env:EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS -eq 'true') {
  throw 'Mock or native tenant mutations are prohibited for this review-only release.'
}
$src = Get-Content -LiteralPath (Join-Path $mobileRoot 'src/api/config.ts') -Raw
if ($src -notmatch 'PAYMENT_WRITES_ENABLED = false' -or
    $src -notmatch 'MOBILE_BUSINESS_WRITES_ENABLED = false') {
  throw 'Native financial write gates must remain disabled.'
}
Write-Host "SOURCE PREFLIGHT PASS: version $version / code $code / package $($app.android.package)."
Write-Host 'Next: verify official owner Play Upload certificate using trusted Gradle/bundletool and run Play Internal UAT; this script does not authorize Production.'
