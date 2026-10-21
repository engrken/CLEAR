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

## Two separate approval gates — no circular dependency

### Gate A: Queue one internal QA APK (before physical phone testing)

1. Review and merge the server's read-only protections (PR #46) and native
   landing UI (PR #49), in that order. Verify **Vercel Production deployment**
   has completed for the exact approved merged `main` SHA. Merely passing
   Preview CI or a GitHub deployment badge does not prove Production database
   identity.
2. A Vercel administrator independently checks **runtime Production**
   `DATABASE_URL` host/database against Neon's primary
   `br-calm-dew-b3vd1ira`. Do not publish a connection string or credentials.
3. Confirm `GlobalMobileSession` migration 10/10 exists (already done),
   mobile API read-only method guards are deployed and responder is HTTPS.
4. **Only then** use GitHub Actions → `CLEAR Android internal Production
   viewer QA APK (build only)` → Run workflow on `main`. Provide:
   exact approved Production-deployed 40-character SHA; true only for the
   independently verified Vercel database mapping; and the literal
   `BUILD_QA_APK_ONLY`.
5. The workflow verifies the pinned API and disabled financial/tenant mutations,
   runs TypeScript, then invokes `eas build --platform android --profile
   live-readonly-internal --non-interactive --no-wait` with the existing
   `EXPO_TOKEN` secret. This **queues** an internal APK; manually confirm
   signing, version, Expo build result and packaged endpoint before installing
   on authorized QA phones. No Google Play submission, publication or
   automatic distribution occurs.

**Physical-device QA is NOT required to queue the QA APK.** Requiring it
before a build would prevent testing and has deliberately been removed.

### Gate B: Approve any distribution (after controlled QA)

Test using registered student and authorized officer/admin identities on real
devices; document results of the matrix below, OTP email delivery, session
expiry, per-tenant role scoping, offline behavior, verified HTTPS endpoint,
and server 403 responses to all mobile business mutations. Review remaining
privacy and licensing issues separately. Only after independent security
sign-off may a future, separately approved release distribute an APK beyond
the explicitly authorized QA team. **There is no such distribution workflow
in this PR.**

For source-only preflight (does not connect to Production):

```powershell
cd mobile
node scripts/verify-live-viewer.mjs
node scripts/verify-live-build-workflow.mjs
npm ci
npm run typecheck
```

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

**Current Gate A blocker:** Independent Vercel-side Production runtime database attestation and exact Production deployment SHA verification. **Gate B blockers (AFTER building):** authorized real email delivery, physical device QA, security and distribution approval; these cannot be asserted from isolated CI.
