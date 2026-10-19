# CLEAR Manila Time — production release readiness

**State:** Release planning only. Do not merge or deploy before the checked gates and an explicit production change authorization.

> **CRITICAL TIMEZONE FINDING (2026-10-19):** Uploaded legacy Apps Script and read-only Neon comparisons confirm mixed timestamp origins within `SystemLog.timestamp`: all 24 older `DAILY_BACKUP` entries match Manila-local backup title times while newer Vercel `AUTOMATED_DAILY_BACKUP` entries match UTC filename times. Legacy payment timestamps may also be local. **The current 33-column UTC-only migration is NOT APPROVED for production.** Prepare a row-/source-aware migration and retest on a fresh unconverted staging branch. See [legacy timezone evidence](manila-legacy-timezone-evidence-2026-10-19.md).

> **UPDATED SCOPE — FUTURE-ONLY TIME STANDARDIZATION (2026-10-19):** Operator confirms the existing records are test data, and historical event-time accuracy is not required. Stop historical-source forensic work; prioritize correct timestamps for newly created CLEAR events. This waives old timestamp accuracy **only**, not financial amounts, accounting dates, identities or data-integrity controls. The original UTC-only migration guard must NOT be falsely acknowledged; prepare a distinct explicitly waived, reviewed migration and obtain separate authorization before any production change. See [future-only time plan](manila-future-only-time-standardization.md). Historical mixed-time evidence remains valid below.

## Final future-only staging rehearsal completed

The new **`clear-manila-future-only-final-staging`** branch was migrated with the explicitly acknowledged test-history waiver; all 33 event-time columns are `timestamptz(3)`, 29 table fingerprints (1,244 rows) match, 15 financial amount totals and 7 accounting date fields match. The guarded migration rejected execution without a waiver. A new test System Log used the correct UTC instant and PHT display, and a five-minute OTP expiry was exactly 300 seconds; both changes were rolled back. Production remains unconverted. See [final staging verification](manila-future-only-final-staging-verification-2026-10-19.md).

## Current evidence

- GitHub draft PR #17: `feature/manila-time-standardization-20261018`, 33 event-instant Prisma fields marked `@db.Timestamptz(3)`.
- The same 33 fields were converted on Neon **`clear-manila-migration-staging`** only. 956 populated UTC-normalized values matched the source; 29 table non-event-data fingerprints, seven accounting dates, and 15 financial metrics also matched.
- Production is Neon project `clear-sys-db`, **default branch `main`** (`br-calm-dew-b3vd1ira`). Its 33 event fields are still `timestamp without time zone`.
- Neon manual snapshot: `CLEAR-pre-Manila-migration-2026-10-19` (`snap-billowing-darkness-b3jiym2l`). Restore test compared all 29 tables / 1,244 rows successfully; **the restore unintentionally finalized and replaced the underlying `main` branch identity**, so do not repeat that process without reviewing `finalize: false`.
- GitHub automated tests cover TypeScript, Prisma validation, timezone edge cases and a production build against isolated PostgreSQL. These are not equivalent to live migrated-staging browser acceptance tests.
- Live staging application acceptance and independent historical UTC provenance must be evidenced separately before production release. Sample data and schema matching alone cannot prove historical UTC encoding.

## Prisma migration history — historical files recovered

Neon production and staging each record five applied migrations. Three original migration SQL files were previously missing from `main` and the feature branch, but were recovered from `sync/vps-mobile`. All three original file SHA-256 values **exactly match** Neon's recorded `_prisma_migrations.checksum` values; they have been restored unchanged to the feature branch. See [Prisma migration history recovery](manila-prisma-migration-history-reconciliation.md).

The distinct `20261017120000_saas_tenancy_and_otp_cap` script exists on `sync/vps-mobile` but is **not applied** in production; it has **not** been copied into this branch. Do not introduce it through a deployment without separate review.

On the local workstation, run **read-only** `npx prisma migrate status` against the **staging connection only** to confirm migration-folder status; this is still pending. The Manila Time timestamp migration was applied manually on staging and has no `_prisma_migrations` row; proper deployment/migration-history integration remains a release gate.

The operator has confirmed successful Manila staging application testing; retain its detailed acceptance evidence. The latest completed GitHub Actions and Vercel checks passed as of 2026-10-19.

## Accepted limitation: no native PostgreSQL dump

On 2026-10-19, the operator elected to **skip the independent `pg_dump` / `pg_restore` backup step**. This is a recovery-safety waiver, **not** proof that a dump was performed or an assurance that a Neon snapshot provides identical recovery flexibility.

Until further notice:
- Retain the verified manual Neon recovery snapshot and original branch; do not delete either.
- Create a **fresh Neon snapshot immediately before any actual production database change**, because the earlier snapshot may not contain intervening transactions; verify its branch and creation time.
- Do not use a Neon restore against production without checking whether the operation finalizes/reassigns branch names and production compute connections.
- Strongly prefer a native dump/restore despite the waiver, especially before any financial-system migration.

## Required live staging application checks (no production credentials in logs)

Run the **Manila GitHub branch** connected exclusively to `clear-manila-migration-staging`, verify the DB endpoint/branch identity in the Neon UI, and **disable scheduled jobs and real outgoing emails** on staging.

- Officer OTP/login, permission-scoped pages, session expiry and lockouts.
- Public student clearance remains public and only exposes cleared/not-cleared; officer view shows authorized details.
- Verify receipt/collection dates, payment posting, negative/void rules, arrears linking, cashier remittance.
- Penalties, collectibles, cash advances, liquidation, report CSV and printable receipts.
- System log timestamps and exports render in PHT; midnight/day boundaries and school-year defaults use `Asia/Manila`.
- Make staging-only test transactions; compare financial ledger changes. NEVER test writes using the production connection string.
- Ensure staging records and test transactions are **never merged over** production records.

## Historical event-time accuracy waived for test records

The existing mixed historical timestamp origins remain proven. The operator accepted their inaccurate display **only because this is test/pilot data**, so forensic classification is not a release blocker for those test timestamps. This does **not** satisfy the original SQL script's UTC-provenance guard. A separately reviewed, explicitly waived **future-only** migration is required to establish correct `timestamptz` semantics for all new events. No old accounting-date or financial amounts may be modified.

## Controlled production release — only after separate explicit authorization

1. Put finance writes and scheduled jobs into maintenance mode; pause email/backup cron and verify no concurrent writes.
2. Capture final production row counts, financial sums and per-table non-event-data fingerprints. Record max timestamps and capture a fresh recovery snapshot. Confirm production is the intended default/compute branch.
3. Following the operator's test-history waiver and separate production authorization, execute a **new explicit future-only, test-history-waiver guarded migration**, reviewed and rehearsed on isolated staging, against the verified PRODUCTION branch. **Do not set** the existing script's `clear.verified_legacy_timestamp_zone=UTC` flag when its UTC assumption is known false.
4. Validate 33 column types and original UTC-normalized timestamp fingerprints, all accounting-date values, and financial ledger invariants.
5. Release the GitHub feature branch application using the Vercel production environment only after the database DDL is complete. Don't deploy the Prisma schema ahead of DB conversion. Confirm `prisma migrate status` and separately reconcile migration-history bookkeeping—manual SQL outside `prisma/migrations` will not be registered automatically.
6. Run post-release read-only SQL and in-browser acceptance checks: login/OTP, public clearance, payments, penalties, advances, remittances, reports, logs, and exports.
7. Resume jobs and writes only after invariants and service health pass. Keep the snapshot and original branch until stability is confirmed.

**Never run `prisma db push` directly against production to force this schema.** Do not merge PR #17 just because CI is green: the release requires a reviewed future-only guarded migration, a coordinated database/app cutover, new-event PHT verification and explicit permission for production DDL.
