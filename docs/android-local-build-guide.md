# CLEAR Android — Windows local QA APK build guide

**Validated 24 October 2026.** Documents an owner-reported successful **ARM64-only internal QA APK** for CLEAR at GitHub commit `ef897e87a65591b1006415964166ad7671c910fa`. The APK was confirmed to exist at `D:\m\android\app\build\outputs\apk\release\app-release.apk` (36,746,427 bytes; modified 2026-10-24 20:06:39 local time). The APK **file** SHA-256 was calculated locally but its value has not been shared. Android `apksigner verify --verbose --print-certs` confirms that the QA APK's **v2 signature verifies**, with one **Android Debug** signer; Play-signing certificate comparison, device installation and functional QA have **not yet been reported**. Do not mark those checks passed.

> **Scope:** Windows internal QA, NOT Google Play release signing. No Neon/Vercel changes, financial transactions, Android keystore edits, or app release are needed to build this APK. Play publishing requires a separately approved, signed, device-compatible AAB and verified release gates.

## Successful workstation configuration

| Component | Observed setup |
| --- | --- |
| Source | `engrken/CLEAR`, SHA `ef897e8` |
| Checkout and QA worktree | `D:\clear-system-saas` and `D:\c\CLEAR-qa` |
| Very short mobile source root | `D:\m` (the `package.json` file is directly inside) |
| Android directory | `D:\m\android` |
| Windows / Node / npm | Windows 10, Node 24.15.0, npm 11.12.1 |
| Java | Temurin 17.0.20.1 |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` |
| CMake / Ninja | SDK CMake 3.22.1 with manually replaced, backed-up Ninja 1.13.2 |
| Gradle | 9.4.1; `--max-workers=2`; `--no-daemon` |
| ABI | `arm64-v8a` (64-bit ARM) only |
| API | `https://clearsys.vercel.app/api/mobile` |
| Release kind | `live-readonly-internal` |
| Source safety gates | `PAYMENT_WRITES_ENABLED = false` and `MOBILE_BUSINESS_WRITES_ENABLED = false` |

This procedure does **not** establish broad Android compatibility: `arm64-v8a` intentionally skips `armeabi-v7a`, `x86` and `x86_64` for internal testing. No phone is required to compile; check a tester's ABI before installation.

## 1. Synchronize and prepare a short physical directory

Check for uncommitted work and only fast-forward a clean repository. Do not overwrite local `.env.local`, keystores or signing credentials.

```powershell
Set-Location "D:\clear-system-saas"
git status --short
git remote -v
git fetch origin --prune
git switch main
git pull --ff-only origin main
git log -1 --oneline
```

To reproduce the short-path workspace safely (do not overwrite an existing `D:\m`):

```powershell
$source = "D:\clear-system-saas\mobile"
$target = "D:\m"
if (Test-Path $target) { throw "D:\m already exists. Do not overwrite it." }
New-Item -ItemType Directory -Force $target | Out-Null
robocopy $source $target /E /XD node_modules android .expo dist web-build /XF "*.tsbuildinfo" ".env*.local" "credentials.json" "*.jks" "*.keystore" "*.p12" "*.p8" "*.key"
if ($LASTEXITCODE -ge 8) { throw "Source copy failed." }
Set-Location $target
if (-not (Test-Path ".\package.json")) { throw "Wrong mobile source root." }
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "Typecheck failed." }
```

Record the actual Git SHA of every new build. The observed successful QA build used `ef897e8`; later Git commits require fresh validation. The source passed `npm run typecheck`. `npm audit --omit=dev` reported 8 advisories (5 high, 3 moderate) in transitive Expo tooling; track these separately and **do not** apply `npm audit fix --force` or downgrade Expo to an incompatible major version.

## 2. Verify Ninja and generate native Android source

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:Path"
java -version
& "$env:ANDROID_HOME\cmake\3.22.1\bin\ninja.exe" --version
```

The validated host reported **Ninja 1.13.2**. Previously, the SDK CMake 3.22.1's bundled older Ninja failed when accessing deeply nested C++ codegen output paths. The local workaround was to back up `%LOCALAPPDATA%\Android\Sdk\cmake\3.22.1\bin\ninja.exe` and replace it with the official `ninja-win.zip` binary from [Ninja 1.13.2](https://github.com/ninja-build/ninja/releases/tag/v1.13.2). Verify the ZIP SHA-256 before extraction:

`07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65`

Stop Gradle/Android Studio before replacement, preserve the original executable with a timestamped backup, and run `ninja.exe --version` after replacement. This is a **local, reversible SDK workaround** which Android SDK Manager may overwrite; it is not a portable repository fix. Prefer a separately reviewed Expo-supported newer CMake installation/configuration for future reproducibility. Never install an unverified Ninja binary.

Then configure the viewer build in the short mobile root:

```powershell
Set-Location "D:\m"
$env:EXPO_PUBLIC_API_URL = "https://clearsys.vercel.app/api/mobile"
$env:EXPO_PUBLIC_CLEAR_RELEASE_KIND = "live-readonly-internal"
Remove-Item Env:\EXPO_PUBLIC_API_MODE -ErrorAction SilentlyContinue

npx expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw "Android prebuild failed." }
```

**Caution:** `npx expo prebuild --clean` removes/regenerates native Android files and can erase manual changes or local signing configuration; use only in a disposable source copy.

## 3. Proven successful ARM64 QA build

Running Gradle with direct PowerShell `*>` redirection previously produced `NativeCommandError` under `$ErrorActionPreference = 'Stop'`. The owner obtained a successful build by invoking Gradle through `cmd.exe`, directing stdout and stderr into a single diagnostic log, and reading the native exit code.

```powershell
Set-Location "D:\m\android"

$env:EXPO_PUBLIC_API_URL = "https://clearsys.vercel.app/api/mobile"
$env:EXPO_PUBLIC_CLEAR_RELEASE_KIND = "live-readonly-internal"
Remove-Item Env:\EXPO_PUBLIC_API_MODE -ErrorAction SilentlyContinue

$command = 'call gradlew.bat :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2 --no-daemon --console=plain > "D:\m\arm64-build.log" 2>&1'
& cmd.exe /d /c $command

$buildExit = $LASTEXITCODE
Write-Host "Gradle exit code: $buildExit"
Get-Content "D:\m\arm64-build.log" -Tail 50
if ($buildExit -ne 0) { throw "Android APK build failed; inspect the log." }
```

Success requires exit code `0` and `BUILD SUCCESSFUL` in the saved log. Limiting to `arm64-v8a` and two workers worked for the local internal QA case; this does not mean the 32-bit ARM failure is resolved.

## 4. Verify generated APK, signature and device compatibility

```powershell
$apk = "D:\m\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) { throw "APK not found." }

Get-Item $apk | Select-Object Name, Length, LastWriteTime
(Get-FileHash $apk -Algorithm SHA256).Hash

# Inspect actual packaged ABIs (requires JDK).
jar tf $apk | Where-Object { $_ -match '^lib/[^/]+/' } | ForEach-Object { ($_ -split '/')[1] } | Sort-Object -Unique

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$apksigner = Get-ChildItem "$sdk\build-tools" -Recurse -Filter "apksigner.bat" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $apksigner) { throw "apksigner not found." }
& $apksigner.FullName verify --print-certs $apk
```

Record the **actual** SHA-256 and certificate fingerprints privately in the QA build record. `assembleRelease` may use debug signing in Expo's generated native setup: verify, do not assume equivalence to the published Play version.

**October 24 observed APK signature evidence:** `apksigner verify --verbose --print-certs` returned `Verifies` with **v2: true**, v1/v3/v3.1/v3.2/v4: false, exactly **1 signer**, certificate DN `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`, SHA-256 certificate fingerprint `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. A debug-signed QA APK is **not** the store-signed app update; compare it to the installed application's **Play App Signing certificate**, not merely the upload-key certificate. Valid v2 signing is sufficient on compatible Android 7.0+ devices; the other schemes' absence alone is not a verification failure. **Never uninstall the user's existing CLEAR app or erase its data** to force installation of an APK signed with a different certificate.

For device-specific testing, `adb devices -l` must show an authorized `device` and `adb shell getprop ro.product.cpu.abilist` must include `arm64-v8a`. `adb.exe: no devices/emulators found` is a USB debugging/driver/authorization issue, not a compilation failure.

**Installed Play app verified, October 24:** OPPO CPH2371, Android API **33**, and package `com.rupertbulquerin.clear` were confirmed over ADB. Limiting `apksigner verify --print-certs` to `--min-sdk-version 33 --max-sdk-version 33` returned `Verifies`, **v3: true**, exit code **0**, and SHA-256 **`e2f951ecef56c07dc8b77bab8f74a3ee4cd463508ca675ec9e3d0eae80f9d58c`**, an exact match with the owner's Google Play **App signing key — In use**. Unrestricted local verifier rejected an additional API 37+ v3.2 ML-DSA PQC signer due to unsupported `KeyFactory`; that tooling limitation did not affect the Android 13 classical signature result. The installed Play app's certificate **does not match** the internal QA debug signer (`fac61745…1033b9c`). Do **not** overwrite or uninstall the Play app; to test on the same device, use a distinct QA `android.package` such as `com.rupertbulquerin.clear.qa` and a distinct URL scheme in a disposable Expo app-config copy, and verify the APK's manifest package before `adb install`. Authenticated deep-link / Android App Link behavior may differ for a QA variant and requires independent testing.

## 5. Historical failure patterns and diagnostics

| Build | Observed failure or outcome | Guidance |
| --- | --- | --- |
| Oct 22, `D:\c\mobile` | Prior Android Gradle build succeeded | Earlier host baseline, not evidence of same source/ABI |
| Oct 24, `D:\c\CLEAR-qa\mobile` | `ninja: Filename longer than 260 characters` for Gesture Handler | Shorter *physical* build root and newer Ninja |
| Oct 24, `D:\m` with older Ninja | `ninja: mkdir(...): No such file or directory` for Gesture Handler | Update verified Ninja, retaining original backup |
| After replacing Ninja, all ABIs | `react-native-worklets` generic `subcommand failed` | Find the **first compiler error**; final Ninja line alone is inconclusive |
| Isolated Worklets `arm64-v8a` | Task exit code `0` | ARM64 native compilation succeeded |
| Full multi-ABI build | Worklets `armeabi-v7a` failed | ARM64-only QA workaround; 32-bit build not repaired |
| PowerShell direct output redirection | `NativeCommandError` | Run through `cmd.exe /d /c` and capture exit code |
| Full ARM64 build | Owner-reported `BUILD SUCCESSFUL`; APK present, 36,746,427 bytes | Certificate, ABI, hash and on-device QA still pending |

If a future build fails, inspect the **first real native compiler error** instead of assuming `ninja: build stopped: subcommand failed` is the cause:

```powershell
Select-String "D:\m\arm64-build.log" -Pattern 'FAILED:', 'fatal error:', 'error:', 'ninja:', 'Killed', 'What went wrong' -Context 5,5 | Select-Object -First 12
```

Do not indiscriminately clear Gradle caches, disable React Native New Architecture, manually increase `CMAKE_OBJECT_PATH_MAX` without checking tool compatibility, or persist hand-edited generated `build.gradle` workarounds without review.

## 6. Play signing attested; isolate QA installation (October 24, 2026)

The owner confirmed Google Play Console **App signing key — In use** SHA-256 `E2:F9:51:EC:EF:56:C0:7D:C8:B7:7B:AB:8F:74:A3:EE:4C:D4:63:50:8C:A6:75:EC:9E:3D:0E:AE:80:F9:D5:8C`. A read-only `adb pull` of the installed base APK from an Android API **33** device was validated using `apksigner verify --min-sdk-version 33 --max-sdk-version 33`. The device's installed CLEAR APK verified via **v3**, exit code **0**, and its certificate SHA-256 **exactly matched** the Google Play fingerprint. Its SHA-1 is `6D:4B:7E:A1:CA:C3:12:8B:06:12:F9:51:7B:68:95:01:F4:EA:23:3A`.

The QA APK's validated v2 **Android Debug** SHA-256 is `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` and **does not match** Google Play's signing key. **Never use this QA APK to update/uninstall the installed Play app.** The previously seen `ML-DSA KeyFactory not available` message came from the APK's API 37+ hybrid v3.2 signer; narrowing verification to actual API 33 successfully verified the relevant classical v3 signature.

**Recommended separate QA variant, only in the disposable short-path native build:** back up the existing QA APK and generated `D:\m\android\app\build.gradle`; add `applicationIdSuffix ".qa"` inside `android { buildTypes { release { ... } } }`, not `defaultConfig`. Rebuild using the proven `cmd.exe /d /c` + `-PreactNativeArchitectures=arm64-v8a --max-workers=2` command. **Before installing**, inspect with Android SDK `aapt dump badging` and require the resulting `package: name='com.rupertbulquerin.clear.qa'` (NOT `com.rupertbulquerin.clear`). Re-verify `apksigner`, ABIs, file SHA-256, and device availability, then install with `adb install` on the authorized QA device. Do not invoke `adb install -r` on the Production package. Confirm both package IDs exist afterward.

These generated-file edits are disposable and may be overwritten by Expo prebuild; no production `mobile/app.json`, `eas.json` or official keystore is modified. A separate app ID does **not** guarantee independent OAuth, Android App Links, QR or OTP callback behavior: both variants may advertise the same `clearsys://` scheme; Play App Links cannot be assumed verified for the new debug certificate. Only test with authorized accounts and stop at any ambiguous external authentication/deep-link callback. Future durable QA variants need a separately reviewed Expo config plugin and explicit test-only link configuration. Do not assume real-device login/UAT passed merely because separate installation succeeded.

## 7. Official Play release is a separate process

- This ARM64 internal QA APK **must not be submitted to Google Play**. The published v1.2.0 release was signed through Rupert's official signing process; keep keystores/Google Play App Signing credentials secret and never commit them.
- For the next version, increase the actual `versionCode`, build a properly signed AAB with appropriate ABI coverage, validate certificate identity and Play Console requirements, and follow the owner-approved [Android major release issue #61](https://github.com/engrken/CLEAR/issues/61).
- Perform real-device OTP/student privacy, cross-tenant access, officer/admin read-only and financial-integrity UAT on the exact candidate APK/AAB. The environment variables alone do not prove server-side authorization.
- Security dependency advisories require separate evaluated remediation before public distribution.
- Docs merges may trigger a Vercel web deployment; they do **not** update the Play Store app.

## References

- [Student-first mobile UAT](mobile-student-first-navigation-next-release.md)
- [Web–mobile parity policy](web-mobile-feature-parity-policy.md)
- [GitHub internal QA APK workflow](../.github/workflows/android-github-native-qa-apk.yml)
- [CLEAR README](../README.md)
