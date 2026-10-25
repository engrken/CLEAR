# Next Android icon — approved design / release integration

Owner accepted redesigned CLEAR blue/gold document + verified magnifier icon for the **next Android Play update**. This work is staged independently of published Play v1.2.2.

## GitHub assets

- `mobile/assets/clear-launcher-vnext.png` — committed compact 128px *preview* of the approved launcher.
- `mobile/assets/clear-adaptive-foreground-vnext.png` — committed compact, alpha-bearing 128px *preview* of the approved, inset adaptive foreground.
- `mobile/app.json` points to these distinct files; adaptive background is white.
- These compact assets let all workstations sync the proposed branding and run preflight tests, but **must not be treated as the final Play artwork**.

## Final original asset handoff and integrity

The owner-approved complete-resolution files are held in `CLEAR_Android_Icon_Assets_Next_Release.zip` supplied in the CLEAR project conversation. Replace the GitHub preview assets with these full-resolution originals in the **same names** before requesting the signed AAB:

| Source in approved package | Target in the repo | Required SHA-256 |
| --- | --- | --- |
| `clear-launcher.png` (1024px, opaque) | `mobile/assets/clear-launcher-vnext.png` | `c1deff4bd85750a7779b566377727a83fcb7bbc1512790e8df8f93c4ebe67fc4` |
| `clear-adaptive-foreground.png` (1024px, alpha) | `mobile/assets/clear-adaptive-foreground-vnext.png` | `23598d480fd8fe054cae0d52bf259824f20b9bf21830c4d060532cd35d72b30b` |

On the authorized workstation, from repository root, after downloading the approved zip:

```powershell
Expand-Archive -Path ".\CLEAR_Android_Icon_Assets_Next_Release.zip" -DestinationPath ".\icon-source" -Force
Copy-Item ".\icon-source\clear-launcher.png" ".\mobile\assets\clear-launcher-vnext.png" -Force
Copy-Item ".\icon-source\clear-adaptive-foreground.png" ".\mobile\assets\clear-adaptive-foreground-vnext.png" -Force
cd mobile
node scripts/verify-live-viewer.mjs --release
```

The `--release` gate checks **1024×1024 + byte-for-byte approved SHA-256** for both icons. The current compact committed previews correctly FAIL that gate. Commit the final PNGs to the review branch, then check Next/Expo and run internal device QA before merging for publication. Do not remove/bypass the release gate.

## Consolidated release acceptance

1. Confirm correct official Android package and owner, no new signing key, and the next unused versionCode across all Play tracks and EAS remote state. Branch stages version `1.2.3` / code 13 as a local-build candidate; verify code 13 is unused on every Play track before upload.
2. Keep web and Android backend access synced, financial and business writes denied unless independently authorized.
3. Inspect generated icon under **round, squircle, and themed masks** on at least one small launcher and one large-screen Android device; check legibility, clipping, background and icon label.
4. Complete the same native role/tenant/student OTP/QR and search UAT tracked in #81, then sign one AAB with the established Google Play Upload key and internal-test before Production.
5. Preserve v1.2.2 Production binary. **This branch and its Vercel Preview do not publish Android.**

## Historical workflow guard

`.github/workflows/android-v122-official-aab.yml` hard-pins the **old** v1.2.2 icon and version. It is a historical release-specific workflow, not proof the new artwork is included. The next-release signing workflow must be reviewed separately and call `node mobile/scripts/verify-live-viewer.mjs --release` before requesting any final AAB.

## Workstation automation (added for v1.2.3)

After checking out PR #96, download `CLEAR_Android_Icon_Assets_Next_Release.zip` from the CLEAR conversation. Use the checked-in PowerShell helpers:

```powershell
cd D:\\clear-system-saas
git fetch origin
git switch feat/android-vnext-icon-and-parity-20261025
git pull --ff-only origin feat/android-vnext-icon-and-parity-20261025
.\\mobile\\scripts\\Sync-ClearAndroidIcon.ps1 -PackagePath "$HOME\\Downloads\\CLEAR_Android_Icon_Assets_Next_Release.zip" -StageForCommit
.\\mobile\\scripts\\Preflight-ClearAndroidV123.ps1 -InstallDependencies
```

The asset helper SHA-256-checks both original full-resolution PNGs before writing anything. Commit/push the changed 1024px images to the PR branch, then repeat CI. Build the AAB on an owner-controlled clean/disposable short-path workspace with the **existing Play Upload keystore**, not the debug signer. After the signed bundle exists, run `mobile/scripts/Verify-ClearAndroidAAB.ps1 -BundlePath <path> -BundletoolJar <path>`, which verifies certificate fingerprint, package, version, code and target SDK. Neither helper signs, publishes, leaks credentials, or edits Production. The historical v1.2.2 workflow is not the new version's signing mechanism.
