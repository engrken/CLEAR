# CLEAR Android launcher correction — v1.2.4 (candidate code 14)

## Evidence and scope

On **25 October 2026**, the owner installed CLEAR **v1.2.3** (code 13 uploaded to Google Play Internal Testing) and provided an Android App Info screenshot showing the **old launcher artwork** despite version 1.2.3. This is a **confirmed on-device icon mismatch**, not proof of any security or payment issue.

Repo assets and Expo config on PR #96 already reference the owner-approved professional blue/gold document + checked-magnifier design:
- `mobile/assets/clear-launcher-vnext.png` (approved 1024px, SHA-256 `c1deff4bd85750a7779b566377727a83fcb7bbc1512790e8df8f93c4ebe67fc4`);
- `mobile/assets/clear-adaptive-foreground-vnext.png` (approved 1024px, SHA-256 `23598d480fd8fe054cae0d52bf259824f20b9bf21830c4d060532cd35d72b30b`);
- `mobile/app.json` points to **both** files, with an opaque launcher and separately padded alpha foreground on white.

These **full-resolution originals are already checked into GitHub**; previous 128px preview instructions are historical and no longer applicable. Do not re-upload or replace them.

Expo documents that `android.adaptiveIcon.foregroundImage` supersedes `expo.icon` for Android and that native config changes require regeneration. Without `--clean`, Expo prebuild can layer edits on existing Android files, leaving stale resources. This is the leading hypothesis for the observed old icon, **not yet proven** without inspecting the exact v1.2.3 artifact. An Android launcher cache can also contribute, so first reboot the phone and recheck App Info and launcher before building another Play version. **Do not uninstall the live app or clear its data.**

- Expo configuration: https://docs.expo.dev/versions/latest/config/app/
- Expo clean prebuild: https://docs.expo.dev/workflow/continuous-native-generation/

## Version safety

Google Play Internal Testing has already received `versionCode 13`, so any **replacement AAB** must use a **higher unused code**. PR #96 now stages **v1.2.4 / code 14** as a *candidate*. Confirm 14 is unused across **all Play tracks**. The APK package and approved Play Upload certificate must remain unchanged.

No backend database changes, financial transactions, permission expansions or Google Play submission are part of this patch. Until fixed, **do not promote icon-defective 1.2.3 to Production**.

## 1. Source synchronization — owner workstation

In PowerShell:

```powershell
cd D:\clear-system-saas
git status --short
git fetch origin
git switch feat/android-vnext-icon-and-parity-20261025
git pull --ff-only origin feat/android-vnext-icon-and-parity-20261025
.\mobile\scripts\Preflight-ClearAndroidV124.ps1 -InstallDependencies
```

Do not discard uncommitted changes or copy old `D:\m123\android` into the next workspace.

## 2. Produce an **entirely new** Android native project, preserving old builds

```powershell
cd D:\clear-system-saas
.\mobile\scripts\Prepare-ClearAndroidV124.ps1 -Workspace "D:\m124" -PreviousWorkspace "D:\m123"
```

The helper:
1. Requires the correct Git review branch, v1.2.4/code14, official package ID and approved **1024px** artwork hashes.
2. Refuses to touch an existing `D:\m124` or any old `D:\m123` build folder.
3. Copies the mobile source **excluding** old native `android/`, compiled dependencies, environment secrets, private keystores or credentials.
4. Runs `npm ci`, mobile TypeScript, then `npx expo prebuild --platform android --clean --no-install` in the brand-new directory with the Production read-only API.
5. Requires native adaptive foreground PNG/WebP and XML resources referencing the foreground. Creates `D:\m124\clear-native-launcher-resources.sha256.txt` as evidence of the generated icon resource hashes and (when available) comparisons to `D:\m123`. **If all comparable foreground resources are byte-identical to the old ones, investigate device caching or actual app resource differences before rebuilding**.

Visually inspect generated icon files in `D:\m124\android\app\src\main\res\mipmap-*` or `drawable-*`. They must show the **new text-free report/checkmark design**, not the old `CLEAR system` wordmark. Compare the round and adaptive XML layers. Merely passing Gradle does not prove this visual check.

## 3. Sign and build the corrected AAB **only after native icon validation**

A clean Expo prebuild regenerates `android/` and may restore the default **debug-signed** release Gradle configuration. Restore the previously verified **Play Upload keystore** and signing block from the owner's **private, external** backup *after* prebuild. Never commit the keys, passwords or signing configuration.

```powershell
cd D:\m124\android
$env:EXPO_PUBLIC_API_URL = "https://clearsys.vercel.app/api/mobile"
$env:EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS = "false"
Remove-Item Env:\EXPO_PUBLIC_API_MODE -ErrorAction SilentlyContinue
.\gradlew.bat :app:bundleRelease --max-workers=2 --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw "Android App Bundle build failed." }
```

Check Play's versionCode 14 availability first; prefer a proper all-ABI bundle rather than the earlier ARM64-only QA workaround.

## 4. Inspect bundle and test the **Play-installed** app

```powershell
cd D:\clear-system-saas
.\mobile\scripts\Verify-ClearAndroidAAB.ps1 -BundlePath "D:\m124\android\app\build\outputs\bundle\release\app-release.aab" -BundletoolJar "D:\tools\bundletool-all-1.18.3.jar"
```

The verifier requires package `com.rupertbulquerin.clear`, version `1.2.4`, versionCode `14`, target SDK 36+, approved Upload key and successful bundletool structural validation.

Upload only to **Internal Testing**, then install/update **through Google Play**. On the device:
- Check the launcher icon **and Settings > App Info** after updating. They must show the new logo at small size, circle and squircle.
- Verify student email OTP, status, student-owned QR, officer role-scoped Receipt/Void reference search, tenant admin and Global Superadmin visibility, and that Android finance/void/remittance/proof mutations remain disabled.
- Confirm the exact installed version `1.2.4` and review Play pre-launch/crash reports; only then consider Production.

**Do not close #61 or merge the release as completed solely because a signed AAB compiles.** The official next Google Play Production decision is separate.
