# Replace compact GitHub icon previews with the two owner-approved originals.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackagePath,[switch]$StageForCommit)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch=(& git -C $root branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or !$branch -or $branch -eq 'main') { throw 'Use the Android review branch, not main or detached HEAD.' }
$zip=(Resolve-Path -LiteralPath $PackagePath).Path
if ([IO.Path]::GetExtension($zip).ToLowerInvariant() -ne '.zip') { throw 'Expected approved icon ZIP.' }
$temp=Join-Path ([IO.Path]::GetTempPath()) ('clear-approved-icon-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  Expand-Archive -LiteralPath $zip -DestinationPath $temp
  $files=@(
    @{Name='clear-launcher.png';Out='clear-launcher-vnext.png';Hash='c1deff4bd85750a7779b566377727a83fcb7bbc1512790e8df8f93c4ebe67fc4'},
    @{Name='clear-adaptive-foreground.png';Out='clear-adaptive-foreground-vnext.png';Hash='23598d480fd8fe054cae0d52bf259824f20b9bf21830c4d060532cd35d72b30b'}
  )
  foreach($file in $files) {
    $src=Join-Path $temp $file.Name
    if (!(Test-Path -LiteralPath $src -PathType Leaf)) { throw ('Missing '+$file.Name) }
    if ((Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.Hash) { throw ('Unexpected SHA-256 for '+$file.Name) }
  }
  foreach($file in $files) {
    Copy-Item -LiteralPath (Join-Path $temp $file.Name) -Destination (Join-Path (Join-Path $root 'mobile\assets') $file.Out) -Force
  }
  & node (Join-Path $root 'mobile\scripts\verify-live-viewer.mjs') --release
  if ($LASTEXITCODE -ne 0) { throw 'Release icon gate failed.' }
  if ($StageForCommit) {
    & git -C $root add -- mobile/assets/clear-launcher-vnext.png mobile/assets/clear-adaptive-foreground-vnext.png
    if ($LASTEXITCODE -ne 0) { throw 'Git staging failed.' }
  }
  Write-Host 'PASS: exact owner-approved 1024px PNGs synced. Commit and push the images to PR #96.'
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
