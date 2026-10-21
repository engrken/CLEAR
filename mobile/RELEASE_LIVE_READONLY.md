# CLEAR Android — Live Production Read-Only Internal APK

**Not released.** This is a new, separately pinned internal build target.
The existing 1.2.0 Preview profile and queued Preview APK remain isolated
against the Preview backend; do not repoint its Vercel alias.

## Build identity and behavior

- Expo app version: `1.2.0` (unchanged pending versioning approval).
- EAS profile: `live-readonly-internal`.
- Platform: Android `apk`, internal distribution; it is **not** an app bundle
  and is **not** a Google Play submission.
- Exact backend: `https://clearsys.vercel.app/api/mobile`.
- `EXPO_PUBLIC_CLEAR_RELEASE_KIND=live-readonly-internal` adds a runtime
  Production URL assertion in `mobile/src/api/config.ts`; release builds
  refuse mock mode and any Preview, localhost, HTTP or third-party endpoint.
- Both business-write gates remain **hard-disabled**:
  `PAYMENT_WRITES_ENABLED=false` and
  `MOBILE_BUSINESS_WRITES_ENABLED=false`. All financial/posting/tenant mutation
  endpoints must remain 403 at the API even for a Global Superadmin.

## Before queuing ANY Production-connected internal APK

1. Merge the reviewed and CI-passing PR #46 and (for native landing) the
   separately reviewed PR #49, after validating merge order. Verify final
   `main` equals the SHA deployed by **Vercel Production**.
2. A Vercel administrator independently checks the actual runtime Production
   `DATABASE_URL` host/project/database against Neon default/primary branch
   `br-calm-dew-b3vd1ira`; do not paste passwords into a PR/chat. Neon's
   linked Production endpoint restriction is supporting evidence only.
3. Confirm `GlobalMobileSession` schema migration is applied (it was verified
   complete on 2026-10-22), app code and API permissions are deployed and
   SMTP sends codes to authorized test identities. No student-ID-only bypass.
4. Use synthetic identity data or explicitly authorized controlled test accounts
   to verify tenant officer permissions, own-tenant portal, independent global
   admin session, student-own clearance, offline/errors, revoked tokens and
   device screen layouts. No production accounting data may be modified.
5. The manual GitHub Actions workflow
   `android-live-viewer-internal-apk.yml` requires the confirmed deployed SHA,
   explicit Production mapping/QA approvals, literal confirmation and an
   existing `EXPO_TOKEN` GitHub secret. Its `--no-wait` step **only queues** an
   Expo EAS build. A separate Expo build completion, signature and on-device
   verification are required before distribution.

For local source verification (does not contact or modify backend):

```powershell
cd mobile
node scripts/verify-live-viewer.mjs
npm ci
npm run typecheck
```

Only after all release gates pass, the approved manual build command is:

```powershell
cd mobile
eas build --platform android --profile live-readonly-internal
```

Do not run this merely because the profile exists. Never substitute
`--profile preview` for a Production live-data APK.

## Device QA matrix (all must pass)

| Actor | Expected result |
|---|---|
| Anonymous | Organization list visible; officer/dashboard/portal/global APIs return 401 |
| Student | Registered-email OTP, only own status/term; no name/ID/balance or QR ID; revoked/expired token denied |
| Officer with `tab-students` | Can view own tenant students, cannot see admin portal/other modules/tenants |
| Tenant admin | Own tenant read-only portal; other-tenant access denied |
| Global Superadmin | Global overview, authorized cross-tenant read-only views; cannot turn token into officer privileges |
| All actors | Posting payments, proof submission, tenant provisioning and remittance approval disabled |
| App/network | Splash, landing page, organizational selection, back navigation, 401/403/error handling, offline retry, HTTPS only |

**Current blockers:** Vercel-side Production env attestation and real email
delivery/physical device QA are external to GitHub's isolated CI checks.
