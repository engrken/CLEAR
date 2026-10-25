# Verify an owner-built signed Play AAB without reading or changing private keystores.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BundlePath,[Parameter(Mandatory=$true)][string]$BundletoolJar)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$aab=(Resolve-Path -LiteralPath $BundlePath).Path
$bundletool=(Resolve-Path -LiteralPath $BundletoolJar).Path
$expected='C7169C0929348A3771A961315FEC28867C8A2DB4F1258DC1DB2CF8B23F41C1A5'
& jarsigner -verify $aab | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'AAB JAR signature validation failed.' }
$cert=(& keytool -printcert -jarfile $aab 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect signed AAB certificate.' }
$m=[regex]::Match($cert,'(?i)SHA256:\s*([0-9a-f:]+)')
if (!$m.Success -or (($m.Groups[1].Value -replace ':','').ToUpperInvariant() -ne $expected)) { throw 'AAB signer differs from official Play Upload certificate. DO NOT UPLOAD.' }
function Read-Manifest([string]$x) {
  $v=(& java -jar $bundletool dump manifest "--bundle=$aab" "--xpath=$x" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) { throw ('bundletool failed: '+$x+' '+$v) }
  return $v.Trim('"',"'")
}
$pkg=Read-Manifest '/manifest/@package'
$name=Read-Manifest '/manifest/@android:versionName'
$code=Read-Manifest '/manifest/@android:versionCode'
$target=Read-Manifest '/manifest/uses-sdk/@android:targetSdkVersion'
if ($pkg -ne 'com.rupertbulquerin.clear' -or $name -ne '1.2.3' -or $code -ne '13' -or [int]$target -lt 36) {
  throw "AAB manifest failed v1.2.3/code13/package/SDK gate: $pkg $name $code $target"
}
Write-Host ('PASS: v'+$name+' code '+$code+', API '+$target+', official upload signer. Bundle SHA-256: '+(Get-FileHash $aab -Algorithm SHA256).Hash)
Write-Host 'Next: install/test via Play Internal release and review device security, permission and functional UAT before publishing.'
