# CLEAR Android v1.2.4: create a fresh Expo Android native workspace.
# Purpose: prevent stale app icons embedded from D:\m123 or an old android/ directory.
# Never copies signing secrets, overwrites an existing workspace, signs, or uploads AABs.
[CmdletBinding()]
param(
  [string]$Workspace = 'D:\m124',
  [string]$PreviousWorkspace = 'D:\m123'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$source = Join-Path $repo 'mobile'
$branch = (& git -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'feat/android-vnext-icon-and-parity-20261025') {
  throw 'Checkout the reviewed Android icon-fix branch first. Never build from an unverified main or detached HEAD.'
}
$manifest = Get-Content -LiteralPath (Join-Path $source 'app.json') -Raw | ConvertFrom-Json
if ($manifest.expo.version -ne '1.2.4' -or $manifest.expo.android.versionCode -ne 14) {
  throw 'Expected CLEAR v1.2.4 / versionCode 14. The Play Internal 1.2.3 code 13 cannot be reused.'
}
if ($manifest.expo.android.package -ne 'com.rupertbulquerin.clear') {
  throw 'Unexpected CLEAR Android applicationId.'
}
if (Test-Path -LiteralPath $Workspace) {
  throw "Destination already exists: $Workspace. Choose an unused short path. Never delete an existing workspace or signing material automatically."
}
& node (Join-Path $source 'scripts\verify-live-viewer.mjs') --release
if ($LASTEXITCODE -ne 0) { throw 'GitHub source must include the exact approved 1024px launcher/foreground assets.' }

# Copy only the mobile project into a brand-new short physical directory.
# The generated old android/ folder, node_modules, local environment files and
# all candidate signing keys are deliberately excluded.
New-Item -ItemType Directory -Force -Path $Workspace | Out-Null
$copied = $false
try {
  & robocopy $source $Workspace /E /XD android ios node_modules .expo dist web-build .git credentials /XF '.env*' '*.jks' '*.keystore' '*.p12' '*.p8' '*.pfx' '*.pem' '*.key' 'credentials.json' '*.tsbuildinfo' /NFL /NDL /NJH /NJS
  if ($LASTEXITCODE -ge 8) { throw "Robocopy failed with exit code $LASTEXITCODE." }
  $copied = $true
  Push-Location $Workspace
  try {
    & node (Join-Path $Workspace 'scripts\verify-live-viewer.mjs') --release
    if ($LASTEXITCODE -ne 0) { throw 'Copied artwork hash validation failed.' }
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Mobile TypeScript verification failed.' }
    $env:CI = '1'
    $env:EXPO_NO_TELEMETRY = '1'
    $env:EXPO_PUBLIC_API_URL = 'https://clearsys.vercel.app/api/mobile'
    $env:EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS = 'false'
    Remove-Item Env:\EXPO_PUBLIC_API_MODE -ErrorAction SilentlyContinue
    # --clean intentionally regenerates all native resources. It is safe here
    # because Workspace is newly created and contains NO signing configuration.
    & npx expo prebuild --platform android --clean --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Clean Expo native regeneration failed.' }
    $res = Join-Path $Workspace 'android\app\src\main\res'
    if (!(Test-Path -LiteralPath $res -PathType Container)) { throw 'Generated Android resources are missing.' }
    $native = @(Get-ChildItem -LiteralPath $res -Recurse -File | Where-Object { $_.Name -match '^ic_launcher(_foreground|_round|_background)?\.(png|webp|xml)$' })
    $foregrounds = @($native | Where-Object { $_.Name -match '^ic_launcher_foreground\.(png|webp)$' })
    $adaptives = @($native | Where-Object { $_.Name -match '^ic_launcher(_round)?\.xml$' })
    if ($foregrounds.Count -eq 0 -or $adaptives.Count -eq 0) {
      throw 'Generated Android adaptive icon layers or XML are absent. Do not sign this build.'
    }
    $referenced = @($adaptives | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw) -match 'ic_launcher_foreground' })
    if ($referenced.Count -eq 0) { throw 'Android adaptive icon XML does not reference the generated foreground.' }
    # Where possible, compare generated resource files against the old workspace.
    # Identical bytes warn that rebuilding may not resolve the old icon problem.
    $comparisons = 0
    $differences = 0
    foreach ($file in $foregrounds) {
      $relative = $file.FullName.Substring($Workspace.TrimEnd('\').Length).TrimStart('\')
      $old = Join-Path $PreviousWorkspace $relative
      if (Test-Path -LiteralPath $old -PathType Leaf) {
        $comparisons++
        $a = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        $b = (Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash
        if ($a -ne $b) { $differences++ }
      }
    }
    $log = Join-Path $Workspace 'clear-native-launcher-resources.sha256.txt'
    $report = @("CLEAR v1.2.4 icon generated after clean prebuild", ("Workspace: " + $Workspace), ("Compared previous foregrounds: " + $comparisons), ("Different foregrounds: " + $differences))
    foreach ($file in $native) {
      $report += ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash + '  ' + $file.FullName)
    }
    $report | Set-Content -LiteralPath $log -Encoding UTF8
    if ($comparisons -gt 0 -and $differences -eq 0) {
      Write-Warning 'New Android launcher foreground files are byte-identical to the old generated workspace. Do not assume rebuilding will fix the icon: inspect the actual Play-installed package or restart launcher before creating another Play update.'
    }
    $releaseGradle = Get-Content -LiteralPath (Join-Path $Workspace 'android\app\build.gradle') -Raw
    if ($releaseGradle -match 'signingConfig signingConfigs.debug') {
      Write-Warning 'Generated Android release Gradle settings still mention DEBUG signing. Restore the OFFICIAL Play Upload signing setup from your PRIVATE backup before creating an AAB. Do not commit keystores or passwords.'
    }
    Write-Host 'PASS: brand-new physical workspace and clean Expo prebuild with verified approved source images.'
    Write-Host ('Generated icon proof: ' + $log)
    Write-Host ('Native adaptive foreground count: ' + $foregrounds.Count)
    Write-Host 'Next: visually inspect the generated launcher foreground and masks, then configure existing private Play Upload signing before bundleRelease.'
    Write-Host 'VersionCode 14 must be unused across all Play Console tracks before upload.'
  } finally {
    Pop-Location
  }
} finally {
  if (!$copied) { Write-Warning 'Copy was interrupted. The newly created workspace may be incomplete; inspect it before using.' }
}
