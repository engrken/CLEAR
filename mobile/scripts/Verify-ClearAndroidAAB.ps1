# Check the owner-built Android AAB; do not sign, alter or upload any artifact.
# Use bundletool from Google's official google/bundletool GitHub release.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BundlePath,
  [string]$BundletoolJar = 'D:\tools\bundletool-all-1.18.3.jar',
  [ValidateRange(15,999999)][int]$MinVersionCode = 15
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if (!(Test-Path -LiteralPath $BundlePath -PathType Leaf)) {
  throw "AAB missing: $BundlePath. Run :app:bundleRelease in the verified Android workspace first."
}
if (!(Test-Path -LiteralPath $BundletoolJar -PathType Leaf)) {
  throw "bundletool missing: $BundletoolJar. Download the official google/bundletool 1.18.3 JAR from https://github.com/google/bundletool/releases/tag/1.18.3 to D:\tools\bundletool-all-1.18.3.jar, check its SHA-256, then rerun. No Android rebuild is necessary."
}
$aab=(Resolve-Path -LiteralPath $BundlePath).Path
$bundletool=(Resolve-Path -LiteralPath $BundletoolJar).Path
if ([IO.Path]::GetFileName($bundletool) -eq 'bundletool-all-1.18.3.jar') {
  $expectedToolHash='A099CFA1543F55593BC2ED16A70A7C67FE54B1747BB7301F37FDFD6D91028E29'
  $actualToolHash=(Get-FileHash -LiteralPath $bundletool -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualToolHash -ne $expectedToolHash) {
    throw 'Downloaded bundletool SHA-256 differs from the official google/bundletool 1.18.3 release asset. Stop, do not run it.'
  }
}
$expected='C7169C0929348A3771A961315FEC28867C8A2DB4F1258DC1DB2CF8B23F41C1A5'

# jarsigner may exit 0 despite informational warnings, notably JarFile versus
# JarInputStream differences on META-INF/MANIFEST.MF. Surface those for review.
$signLog=(& jarsigner -verify -verbose:summary $aab 2>&1 | Out-String)
$signExit=$LASTEXITCODE
if ($signExit -ne 0 -or $signLog -notmatch '(?i)jar verified') {
  throw ("AAB JAR signature validation failed (exit $signExit). Examine jarsigner -verify -verbose -certs output. "+$signLog)
}
if ($signLog -match '(?i)internal inconsistencies|signed in JarFile but is not signed in JarInputStream') {
  Write-Warning 'Java reported a JarFile / JarInputStream manifest consistency warning. This is not itself a cryptographic failure, but review full jarsigner diagnostics and Play Internal acceptance before publishing.'
}
$cert=(& keytool -printcert -jarfile $aab 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect signed AAB certificate.' }
$m=[regex]::Match($cert,'(?i)SHA256:\s*([0-9a-f:]+)')
if (!$m.Success -or (($m.Groups[1].Value -replace ':','').ToUpperInvariant() -ne $expected)) {
  throw 'AAB signer differs from official Play Upload certificate. DO NOT UPLOAD.'
}
$validate=(& java -jar $bundletool validate "--bundle=$aab" 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw ('Official bundletool AAB structural validation failed: '+$validate) }
function Read-Manifest([string]$x) {
  $v=(& java -jar $bundletool dump manifest "--bundle=$aab" "--xpath=$x" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw ('bundletool failed: '+$x+' '+$v) }
  return $v.Trim('"',"'")
}
$pkg=Read-Manifest '/manifest/@package'
$name=Read-Manifest '/manifest/@android:versionName'
$code=Read-Manifest '/manifest/@android:versionCode'
$target=Read-Manifest '/manifest/uses-sdk/@android:targetSdkVersion'
$api=0
if (![int]::TryParse($target, [ref]$api)) { throw ('Unable to parse targetSdkVersion: '+$target) }
$numericCode=0
if (![int]::TryParse($code, [ref]$numericCode)) { throw ('Unable to parse AAB versionCode: '+$code) }
if ($pkg -ne 'com.rupertbulquerin.clear' -or $name -ne '1.3.0' -or $numericCode -lt $MinVersionCode -or $api -lt 36) {
  throw "AAB manifest failed v1.3.0/minCode$MinVersionCode/package/SDK gate: $pkg $name $code $target"
}
Write-Host ('PASS: AAB signature, bundle structure, v'+$name+' code '+$code+', API '+$target+', official Upload signer.')
Write-Host ('Bundle SHA-256: '+(Get-FileHash -LiteralPath $aab -Algorithm SHA256).Hash)
Write-Host ('Before Play Internal upload: independently verify versionCode '+$code+' is UNUSED across all Play tracks. No Play upload was performed by this check.')
