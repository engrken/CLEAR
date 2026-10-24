# CLEAR Android v1.2.2 — branded Production release preflight

**Status:** Prepared source only; do **not** label the app released or upload to Production before the complete gates pass.

## Scope

- Version name **1.2.2** in `mobile/app.json`, retaining `com.rupertbulquerin.clear`, established Expo project and the Production API.
- CLEAR launcher/adaptive icon from the existing branded website artwork, copied to **`mobile/assets/clear-launcher.png`** so EAS builds rooted at `mobile/` include the asset. Inspect launcher scaling and masking on a real Android device; do not infer quality from a PNG existence check.
- Separate backend Activity hotfix **PR #77** is already merged and Vercel Production READY at commit `a1ab7d877f667fabb42f2f6b2e39e4dba1e65f6c`. The owner confirmed **Global Superadmin → JIECEP → Activity** works on the existing Play Internal v1.2.1 app after that deployment. The server fix does not require an Android upgrade.
- Production submission configuration is staged separately in **PR #78** as Play track `production` with `releaseStatus: draft`; no public rollout is authorized by this configuration.

## Critical safety and version gates

1. Preserve `PAYMENT_WRITES_ENABLED = false` and `MOBILE_BUSINESS_WRITES_ENABLED = false`. The only proposed native business mutation is a separate, explicitly opted-in Global Superadmin tenant lifecycle capability; the server defaults to DENY until an authorized production rollout. No financial posting or database migration is part of this release.
2. Web ↔ Android parity: verify public student clearance tutorial/OTP/status-only flow; officer module directory and independently authenticated, role-granted web transaction handoffs; tenant isolation; global admin cross-tenant Activity; receipt/void recent search; and deny-by-default native financial operations. Validate with authorized accounts only.
3. Verify **all GitHub status checks** on the final release commit, including `live-viewer-config`, finance tests, mobile role tests and Android native debug compilation where applicable. A debug APK proves compilation, not Play signing or security acceptance.
4. Keep all release certificates, Expo tokens, Play credentials and private signing keys out of GitHub and chat.
5. Check Play Console **highest versionCode across all testing and production tracks**. v1.2.1 Internal was code **11**. Source `android.versionCode: 12` is a proposed local baseline, **not** evidence of the final cloud build code: `mobile/eas.json` uses `cli.appVersionSource: remote` and `build.production.autoIncrement: true`. EAS remote state is authoritative and may use another number. Verify the final AAB before uploading.
6. As of 31 Aug 2026, Google Play normally requires **targetSdkVersion 36+** for new Android app updates. Expo SDK 58 (current project dependency) normally targets 36, but inspect the **compiled Android manifest/AAB** to confirm rather than assuming.
7. Compare signed upload artifact with the established **Google Play Upload key** (not the different Play App Signing key). Verify Android package, versionName, versionCode, targetSdkVersion, supported ABI, app size and Play Console upload acceptance.
8. Recheck Google Play Production access, Data safety, store listing, privacy policy, reviewer app-access instructions, and pre-launch report. Production is to be submitted as a **draft** and later manually staged/published only after authorized owner approval.

## Reproducible source preflight

From a clean repository worktree at the **final reviewed commit**:

```powershell
git status --short
git log -1 --oneline
npm ci
npm run test:mobile-roles
npx tsc --noEmit
Set-Location .\mobile
npm ci
npm run typecheck
node scripts/verify-live-viewer.mjs
node scripts/verify-live-build-workflow.mjs
npx expo config --type public --json
```

Confirm `expo.version = 1.2.2`, package `com.rupertbulquerin.clear`, and both icon paths inside `./assets/`. Confirm the release profile still points only to `https://clearsys.vercel.app/api/mobile` via HTTPS. These checks do not sign an app or verify final installed branding.

## Official signed AAB preparation (authorized Expo/signing owner only)

Only after PR #78 and PR #79 are reviewed, merged and their new `main` commit is verified:

```powershell
Set-Location .\mobile
# Inspect official EAS credentials and remote app version; never paste keys/tokens.
# Confirm no previously used Play versionCode will be duplicated.
npx eas-cli build --platform android --profile production
```

Do **not** confuse this cloud AAB with the earlier debug-signed QA APK. Confirm the Expo project/owner and the generated artifact ID. If using the established Windows local AAB process instead of EAS, retain its official upload-key signing configuration and independently verify `bundleRelease` output.

Upload the verified artifact first for controlled internal testing, and repeat the critical acceptance matrix on the installed Play-signed v1.2.2 build: Android home icon/adaptive mask, splash, student clearance OTP, officer module search and authenticated web handoffs, tenant-scoped access, JIECEP Activity/Refresh with receipt/void filtering, remittances, permitted tenant-management pathways, and strict denial of unapproved native payment/receipt/financial write operations.

When all checks pass, the release submission PR #78 intentionally configures `production` **draft** submission. An authorized owner may run `eas submit --platform android --profile production` with the **verified AAB build ID**, inspect Play Console validation and the pre-launch report, and manually choose an appropriate staged rollout. Never automatically publish or claim public release from a GitHub merge.

## Acceptance log

| Check | Status |
| --- | --- |
| v1.2.1 JIECEP Activity after backend fix | **PASS — owner-confirmed real-device test** |
| PR #77 Production backend deployment and domain alias | **PASS** |
| v1.2.2 mobile source version/icon packaging | **Staged in draft PR #79** |
| v1.2.2 final branch GitHub CI | **Pending final green result** |
| Signed release AAB, SDK level, versionCode and fingerprints | **Not yet verified** |
| v1.2.2 Play-signed real-device regression | **Not yet tested** |
| Production draft submission and staged rollout | **Not submitted** |

## v1.2.2 expanded operations and open GitHub issues

The production-facing role-based operational expansion is staged on draft PR #80, atop branded PR #79. All nine final source validation workflows passed on PR #80 before this release-document update. Native Gradle compile of the operational sources is an **independent** gate, not implied by the successful earlier branded #79 build.

- **Students:** verified registered-email OTP to view own clearance, plus first-party department web services entry; proof uploads in native remain disabled because that backend operation currently returns 503. Do not send student identifiers or OTPs in URLs.
- **Officers:** modules from their verified server `allowedTabs` plus authorized web handoffs for collections, receipt history, remittance verification, penalties, advances, liquidations, reports, voids, fund realignment, user management and setup. Web requires a new sign-in and rechecks roles.
- **Tenant administrators:** own-tenant status in Android with official own-tenant web setup/operations. Web server remains tenant-authoritative.
- **Global Superadmin:** cross-tenant Activity and tenant directory, plus web provisioning access. Optional native provision/manage only if **both** `EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS=true` (build) and `MOBILE_TENANT_OPERATIONS_ENABLED=true` (Vercel server) are independently enabled after Preview testing and owner approval. Default remains FALSE. This is not general financial write access.
- **Issue #65:** on-device search filters the **recent, already loaded authorized** Activity batch by OR, student name, description, status and voided collection; never represent this as the complete historical ledger. Full receipt/void audit remains available via approved web module. Real-device QA is still required.
- **Issue #77:** regression fix for fractional penalties is explicitly present in the #79/#80 branch ancestry; owner has already passed authenticated Activity UAT on v1.2.1 after production backend deployment.
- **Issues #47/#50/#57:** preserve private OTP, reject public student enumeration and do not restore external QR provider. Signed certificate QR graphics/opaque identifiers are a separately gated item.
- **Issues #68/#69/#70:** no bulk money schema migration or historical receipt rewriting to satisfy a mobile deadline; benchmark performance on Preview separately and preserve a supervised finance reconciliation audit.
- **Issue #58:** officially signed AAB must use the verified existing upload keystore and match Play Console. Unsigned/debug APK validation cannot satisfy this gate.
- **Issues #61/#64/#81:** keep consolidated release and mobile/web parity tracking open until accepted in the actual Play build.

An operable Android v1.2.2 release may include audited web handoffs, but any native write action without server implementation, tenant-scoped role authorization, idempotency and audited financial invariants is **not** ready. See `docs/mobile-v122-operational-capabilities.md`.
