# CLEAR — production read-only release runbook (2026-10-22)

**Status: Global mobile session Production SCHEMA MIGRATION COMPLETED; APP RELEASE STILL BLOCKED.** This runbook preserves the pre-migration checks and records the later verified outcome. App rollout, mobile login QA, merging PRs and APK publication are not implied by a successful schema migration. The canonical web finance ledger stays writable
only under existing, authorized web roles. Android financial/tenant **business
mutations remain disabled for every actor**.

## Verified production migration outcome — 2026-10-22 (current)

- Owner-authorized Production schema migration applied transactionally at **2026-10-21 22:36:09.837 UTC** to Neon's default/primary branch `br-calm-dew-b3vd1ira`, database `neondb`, project `wandering-wind-73071792`.
- Applied **exact GitHub file** `prisma/migrations/20261021173000_global_mobile_sessions/migration.sql` (blob `5a4346520558e3488dfcc3061bd1b22741e5cc79`), with its SHA-256 checksum `b88ea9110e57be81bc0caca174ddb536d19a94334814d03ed5b41a25f9e716e8` recorded in `_prisma_migrations` in the same database transaction. Migration marked finished, not rolled back; **10/10 committed migrations now recorded**. No `prisma db push` performed.
- New `GlobalMobileSession` has **zero rows**, a primary key and **three expected indexes**. Its schema exactly matches isolated rehearsal `br-plain-base-b36kng96` (empty schema diff).
- **All 11 existing business-data tables were unchanged before/after by exact row-count and full-row aggregate fingerprint checks**: Organization, Student, Collection, CollectionSetup, Collectible, Penalty, PenaltySettlementEvent, CashAdvance, CashierRemittance, OnlineRemittance and DigitalReceiptDelivery. The Production totals remained **3 organizations / 104 students / 495 Collection rows / ₱125,251 recorded gross**.
- User-created up-to-date Production recovery snapshot `snap-hidden-surf-b3vur7bb`, created `2026-10-21T22:28:57Z`, was confirmed before applying schema DDL. Separately, untouched current recovery clone `br-shy-glade-b3i6cbf9` was verified schema- and record-identical with Production **before** migration. These two are the rollback references; do not restore over active Production automatically.
- The Android Preview branch has the same `GlobalMobileSession` table layout/indexes but stores a **different prior checksum** for this migration (`b3ec8f925c0a81aff434a7b10b0d588b6866fb8fc4e4c9b2ac6f03c2da3f9925`). This suggests its original applied migration file differed from the current file. Track/reconcile Preview migration-history drift before any Preview migration synchronization. The newly applied Production checksum **matches current GitHub source exactly**.
- **Still blocked:** independently verifying Vercel's actual Production `DATABASE_URL` from the Vercel app, real SMTP and device QA, signed build endpoint/permissions, public-web clearance disclosure policy and formal PR/release review. Do not merge draft PRs or distribute an APK solely because the database table exists. The Production website and app code were not redeployed as part of this schema change.

The following sections document the earlier baseline and procedural safeguards; any “migration pending” statements below describe the state **before** the successful operation recorded above.

## Pinned code and dependencies

- Base Production GitHub `main` at initial review: `819517171720cb9b9ba4833f9078a651cb9c3c15`.
  GitHub Vercel commit status reported a successful deployment. This does NOT
  prove the Vercel Production `DATABASE_URL` or live deployed environment.
- Draft [PR #46](https://github.com/engrken/CLEAR/pull/46) holds server-side
  mobile read-only enforcement, role scopes, mobile student OTP and global
  session schema migration. CI must pass at the final reviewed HEAD.
- Dependent [PR #51](https://github.com/engrken/CLEAR/pull/51) stages an
  **opt-in** private web student inquiry. The flag
  `CLEAR_PUBLIC_CLEARANCE_REQUIRE_OTP=true` is OFF until separately approved.
- Draft [PR #49](https://github.com/engrken/CLEAR/pull/49) is native Android
  landing UI; align its Git base and permissions with final #46 before merge
  or APK release. Do not treat a Preview EAS APK as Production.
- Privacy follow-ups: [#47](https://github.com/engrken/CLEAR/issues/47)
  (verified students/registered email) and [#50](https://github.com/engrken/CLEAR/issues/50)
  (public web enumeration and signed URL/third-party QR leakage).

## Pre-migration Neon observations (historical)

- Project `wandering-wind-73071792` (`clear-sys-db`); current primary
  `br-calm-dew-b3vd1ira` (database `neondb`).
- Primary had 3 organizations and 104 students; 94 plausible registered
  emails and 10 missing, **aggregates only**.
- Primary lacked table `GlobalMobileSession` and committed migration
  `20261021173000_global_mobile_sessions`.
- Isolated clone `br-plain-base-b36kng96` rehearsed exactly the table,
  primary key and three indexes; schema diff was additive. This rehearsal
  DID NOT apply the migration to primary or update its migration registry.
- Neon returned `snapshots limit exceeded` for a new primary snapshot and
  `branches limit exceeded` for a new primary recovery clone.
  **Hard stop:** restore capacity or raise limits and obtain a fresh, verified
  rollback point before any Production schema write.
- Existing snapshot `snap-polished-queen-b3oluewi` was left intact. Do not
  delete it or any old Neon branch without separate explicit authorization.

## Mandatory stop-gate checklist — in order

1. **Production environment identity.** A Vercel administrator verifies the
   *actual* Production deployment SHA, project/environment, runtime
   `DATABASE_URL` host, database name and targeted Neon branch. Compare
   Vercel environment metadata and Neon connection metadata directly, not
   text copied from a Preview build. Never paste or log passwords/tokens/URL
   query parameters into GitHub, public issues or support chats. A GitHub
   deployment-success badge is insufficient evidence.
2. **Fresh backup with usable restore path.** Resolve Neon branch/snapshot quota
   with provider capacity or explicit owner-approved cleanup. Capture a fresh
   primary recovery point; record its ID and simulate a safe non-finalizing
   restore/verification before applying Production DDL.
3. **Version/SQL approval.** Review the exact SQL in
   `prisma/migrations/20261021173000_global_mobile_sessions/migration.sql`
   and all migrations not yet recorded in Production. Never infer that only
   one migration is pending without a fresh migration-history diff. Confirm
   schema parity and expected role/API access.
4. **Controlled migration.** Only after written authorization, run
   `npx prisma migrate deploy` from the exact approved/reviewed code revision
   with an explicitly scoped **Production** environment. Never use
   `prisma db push`, generic schema synchronization, SQL pasted from a
   Preview database, or unspecified credentials. Record applied migration IDs
   and verify schema objects and constraints immediately.
5. **Release verification.** Deploy only the reviewed web/mobile server
   revision with the expected migration state. Reconfirm Production SHA/branch
   attestation, execute **safe read-only** endpoint checks, and validate
   authenticated tenant/global role behavior using approved test identities.
   Preserve OTP/session lifecycle writes but deny business POST/PATCH/DELETE
   in the mobile API.
6. **Student identities, QA and device release.** Confirm registered-email SMTP,
   rate limits, anti-enumeration, session revocation, student/tenant/term
   boundaries, arrears correctness, and no-store; privately backfill the ten
   missing student emails with tenant-supervised verification, never an
   ID-only bypass. Use a signed internal APK with an explicitly inspected
   `EXPO_PUBLIC_API_URL=https://clearsys.vercel.app/api/mobile`. Test
   JIECEP officer, tenant admin, other tenant, superadmin and student on
   actual phones. Keep `PAYMENT_WRITES_ENABLED=false` and
   `MOBILE_BUSINESS_WRITES_ENABLED=false`.
7. **Public web privacy cutover, separately approved.** Only after #51 is
   reviewed, merged and verified with server OTP in the same deployment,
   enable `CLEAR_PUBLIC_CLEARANCE_REQUIRE_OTP=true`. Do not activate ahead
   of registered-email delivery. Signed legacy certificate verification is a
   separate policy with known school ID/QR data disclosure tracked in #50.
8. **Sign-off and rollback drill.** Reviewer checks financial reconciliation
   against pre-deployment read-only aggregates and validates no ledger writes.
   Revert an unsafe web deployment to the last known-good SHA; disable new
   APK distribution. Authentication table removal is NOT an automatic
   rollback (preserve sessions/audit or explicitly review cleanup); use the
   verified backup for material data incidents only after approval.

## Non-secret read-only Production SQL preflight

```sql
SELECT to_regclass('public."GlobalMobileSession"') AS global_session_table;
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20261021173000_global_mobile_sessions';
SELECT (SELECT COUNT(*) FROM "Organization") AS organizations,
       (SELECT COUNT(*) FROM "Student") AS students;
```

**After an authorized migration only:**
```sql
SELECT to_regclass('public."GlobalMobileSession"') AS global_session_table;
SELECT indexname FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'GlobalMobileSession'
 ORDER BY indexname;
SELECT migration_name, finished_at
 FROM "_prisma_migrations"
 WHERE migration_name = '20261021173000_global_mobile_sessions'
   AND finished_at IS NOT NULL AND rolled_back_at IS NULL;
```

## What may continue before sign-off

- Draft/CI-only code changes, regression tests with synthetic data and disposable
  PostgreSQL, branch-isolated migration rehearsal, non-secret environment
  metadata review and release documentation.
- No production DB mutation, no force-merge, no toggling private-status gates,
  no Production APK release, and no deletion of current recovery assets.
