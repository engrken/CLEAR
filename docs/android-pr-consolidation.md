# CLEAR Android PR consolidation — 2026-10-21

## Source pull requests

- [#18](https://github.com/engrken/CLEAR/pull/18) — historical Android API/app implementation, based on older web finance rules; superseded as integration target by [draft #41](https://github.com/engrken/CLEAR/pull/41).
- [#40](https://github.com/engrken/CLEAR/pull/40) — follow-on payment/security patch against the old #18 branch; **must not be merged** because its `MobilePaymentIdempotency` model and caller-provided OR handling diverge from current web `PaymentRequest` + server-allocated OR semantics.
- [#45](https://github.com/engrken/CLEAR/pull/45) — independent smaller, read-only mobile API proposal against `main`; keep open for a **separate controlled production rollout** if that is desired. Do not merge just to close it while Vercel/CI checks are failing.
- [#41](https://github.com/engrken/CLEAR/pull/41) — sole active Android APK + API integration workstream; remains draft, no production merge.

## What was carried into #41

- Department officer OTP, tenant-bound sessions, read-only org/financial/roster/clearance routes, Expo native app, safe HTTPS API configuration, server-side permission enforcement.
- Independent global-superadmin OTP/session + read-only overview on the Android integration branch.
- `tests/financial-engine-parity.test.mjs` from #45/#18 and registration under `npm run test:finance`: current web and mobile *read-only financial calculation bodies were compared before copying the test and matched*. Changes can now fail regression checks if the mirror drifts.
- `tests/financial-integrity-android-readonly.test.mjs` and `tests/mobile-role-parity.test.mjs`: keep accounting writes disabled and test role-key parity.

## Historical items NOT ported or NOT certified complete

1. **#18 mobile integration tests:** `tests/mobile-api/**`, including officer OTP, expiry/revocation, tenancy, no account enumeration, clearance, financial package/penalty/payment/retry, remittances. Adapt to #41's actual read-only route surface, isolated synthetic-data fixtures, and current schema; do not blindly run older write tests against the new preview, which may contain copied production data.
2. **#18 release/Play Store artifacts:** `mobile/store/**`, icon/splash binaries under `mobile/assets/**`, `app/account-deletion/page.tsx` and privacy compliance items. Check current `main` individually before selectively porting. No unverified assets included in the release.
3. **#40 financial idempotency audit:** `mobile/docs/payment-idempotency-verification.md`, `security-integrity-gate.md`, `web-mobile-parity-audit.md` remain available in the closed PR's branch/history as reference. Its `prisma/migrations/20261021000000_mobile_payment_idempotency` is **not** authorized for Production. Use the canonical web `PaymentRequest`, `allocateOfficialReceiptNumber`, and `withFinancialTransaction` policies for any eventual mobile money routes.
4. **#45 independent Production proposal:** its branch is currently 1 commit ahead of its original `main` base, contains a read-only mobile API but is older than #41's security and role changes. Do not deploy the older version into Production without re-review, explicit authorization and CI pass.
5. **Preview/CI:** Vercel has reported a deployment build-rate limit. GitHub checks and real-device Android role matrix must pass. PR #41 has diverged from `main` and must be reconciled before merge.
6. **Financial parity:** cashier posting, remittance verification/invalidation, official receipt allocations, voids, penalty settlements, package split and concurrent retries are NOT implemented as validated shared mobile financial services. `PAYMENT_WRITES_ENABLED=false` is mandatory.

## Closure policy

Close historical drafts #40 and #18 as **superseded / not merged** only after citing this work log in their PR comments. Closing does not delete branches, commits or their tests. Keep PR #41 draft and #45 open pending a deliberate deployment decision.

## Non-production acceptance checks

```powershell
git switch android-parity-integration
git pull --ff-only origin android-parity-integration
npm run test:finance
npm run test:mobile-roles
npm ci
npx tsc --noEmit
cd mobile
npm ci
npm run typecheck
```

When Vercel allows another Preview deploy, validate OTP, revocation, tenant scoping, every role and module grant, denial of global tokens on tenant endpoints, and read-only financial totals on the isolated Neon Android Preview branch. Do not turn on financial writes or merge into `main` until independently approved.

## Preview deployment retry after Vercel plan upgrade (2026-10-21)

The repository owner requested a fresh **Preview-only** deployment attempt of
`android-parity-integration` after upgrading the Vercel plan. This documentation
commit is intentionally used as a GitHub push to re-trigger the existing Vercel
Git integration; it makes **no API, Prisma, Expo, or financial behavior changes**.

Expected deployment target: branch-specific Preview URL
`https://clearsys-git-android-parity-integration-kentbsece-7567.vercel.app`.
The Vercel branch-specific `DATABASE_URL` must remain scoped to the isolated
Neon Android Preview branch. Check Vercel's deployment status and the
`/api/mobile/orgs` read endpoint after the build. Do not merge to `main`,
deploy Production, or enable Android financial writes as part of this retry.
