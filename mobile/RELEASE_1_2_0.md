# CLEAR Android 1.2.0 — Release 1 (isolated Preview)

Target: Expo internal Android APK, `android-parity-integration` / draft PR #41.
This is **NOT** a production SaaS deployment and is NOT a Google Play release.

## Release 1 features

### Global Superadmin
- Separate email OTP with the canonical CLEAR web OTP policies (5-minute code,
  cooldown, attempt lockout), six-hour revocable global sessions, and membership
  revalidation on every authenticated endpoint.
- The bootstrap superadmin configured by Vercel `SUPER_ADMIN_EMAIL` has the
  same Global Superadmin web-authorized scope. It does **not** need a tenant
  officer account in JIECEP.
- Cross-tenant overview: access all tenants, including archived entities, in
  read-only mode; view financial summary, students, activity and remittances.
- New **Tenant management** portal: all school groups, subscription tiers,
  tenant status, student/collection/officer counts, and management actions.
- New **Provision tenant** page: create organization + initial officer admin +
  academic period in one SERIALIZABLE PostgreSQL transaction.
- New **Manage tenant** page: change tier, status and school group with
  server-validated confirmation and audit logging.
- Provisioning operations use the **same core business rules as web**
  (`lib/provisioning/core.ts`), including group tier limits (Freemium 2,
  Pro 10), reserved global-admin emails, and setup calendar/owner creation.

### Department officers
- Separate officer OTP sign-in, scoped by tenant membership and effective
  web-assigned modules. JIECEP's officer login is not a global-admin bypass.
- Initial officer overview, authorized student roster and remittance proof
  inspection, role-access panel and sign-out.
- Easy link from JIECEP/officer account screens to Global Superadmin sign-in.

## Release 1 boundaries

- **NO** mobile payment collection, official receipt numbers, remittance
  verification, invalidation, penalties settlement, voids, transfers,
  liquidation, or other financial writes. `PAYMENT_WRITES_ENABLED=false`.
- No permanent tenant deletion or mobile global-admin invitation/revocation.
  The web system remains the audited authority for those high-risk operations.
- Android provisioning **mutations** are allowed only when Vercel reports
  `VERCEL_ENV=preview` and
  `VERCEL_GIT_COMMIT_REF=android-parity-integration`.
  The mobile API is fixed to the isolated Vercel Preview alias.
- The Neon branch contains copied Production student and financial data.
  Only perform deliberate, necessary test operations; do not use production
  student or payment records as fixtures. Never log tokens or OTPs.
- Only verified GlobalMobileSession Bearer tokens may call global tenant
  management endpoints. Department officer tokens cannot grant that scope.

## Acceptance gates BEFORE releasing the APK

1. `npm run test:mobile-roles` passes (including provisioning parity).
2. `npx tsc --noEmit` in repo root and `npm run typecheck` in `mobile/` pass.
3. Vercel Preview deploy for the current branch responds with HTTP 200 for
   `/api/mobile/health`, and 401 JSON when the unauthenticated client calls
   `/api/mobile/global/provisions` and other global endpoints.
4. Expo EAS build with `preview` profile and incremented Android build number
   finishes; GitHub's `--no-wait` queue success alone does NOT mean APK success.
5. On a test phone, sign in as Vercel bootstrap Global Superadmin; open JIECEP
   and another tenant; verify tenant management list. If provisioning is tested,
   use a clearly synthetic disposable tenant only. Never touch accounting
   information. Check current first academic period and initial owner.
6. Sign in as JIECEP officer and verify authorized overview and role guard.
7. Validate token revocation and that department officer token cannot access
   global provisioning or other tenant data.
8. Confirm Production `main` and `https://clearsys.vercel.app` unchanged.

## Release 2 candidates (NOT in this APK)

- Remaining web department modules, including official financial operations
  only after parity, transaction idempotency and server-issued receipt tests.
- Tenant administration improvements and design refinements based on feedback.
- Dedicated `expo-updates` Preview channel for future JS-only over-the-air
  updates, with full native build required for any native module changes.
