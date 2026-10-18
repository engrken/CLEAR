# CLEAR Manila Time — production release readiness

**State:** Release planning only. Do not merge or deploy before the checked gates and an explicit production change authorization.

## Current evidence

- GitHub draft PR #17: `feature/manila-time-standardization-20261018`, 33 event-instant Prisma fields marked `@db.Timestamptz(3)`.
- The same 33 fields were converted on Neon **`clear-manila-migration-staging`** only. 956 populated UTC-normalized values matched the source; 29 table non-event-data fingerprints, seven accounting dates, and 15 financial metrics also matched.
- Production is Neon project `clear-sys-db`, **default branch `main`** (`br-calm-dew-b3vd1ira`). Its 33 event fields are still `timestamp without time zone`.
- Neon manual snapshot: `CLEAR-pre-Manila-migration-2026-10-19` (`snap-billowing-darkness-b3jiym2l`). Restore test compared all 29 tables / 1,244 rows successfully; **the restore unintentionally finalized and replaced the underlying `main` branch identity**, so do not repeat that process without reviewing `finalize: false`.
- GitHub automated tests cover TypeScript, Prisma validation, timezone edge cases and a production build against isolated PostgreSQL. These are not equivalent to live migrated-staging browser acceptance tests.
- Live staging application acceptance and independent historical UTC provenance must be evidenced separately before production release. Sample data and schema matching alone cannot prove historical UTC encoding.

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

## Timestamp provenance gate

For representative historical `SystemLog.timestamp`, `Collection.timestamp`, `OnlineRemittance.timestamp`, OTP expiries and mobile-session events, verify that legacy wall-clock values were recorded in UTC, using trustworthy server/app historical evidence or independently recorded event times. A UTC session timezone plus ORM defaults is suggestive but insufficient for records entered before the current code. If any values were Manila-local or mixed, stop and amend the migration by column/period.

## Controlled production release — only after separate explicit authorization

1. Put finance writes and scheduled jobs into maintenance mode; pause email/backup cron and verify no concurrent writes.
2. Capture final production row counts, financial sums and per-table non-event-data fingerprints. Record max timestamps and capture a fresh recovery snapshot. Confirm production is the intended default/compute branch.
3. With approved UTC provenance, run the **reviewed transaction-scoped** SQL `scripts/sql/manila-event-time-migration.sql` against the verified PRODUCTION branch only, in the same session as the explicit guard flag.
4. Validate 33 column types and original UTC-normalized timestamp fingerprints, all accounting-date values, and financial ledger invariants.
5. Release the GitHub feature branch application using the Vercel production environment only after the database DDL is complete. Don't deploy the Prisma schema ahead of DB conversion. Confirm `prisma migrate status` and separately reconcile migration-history bookkeeping—manual SQL outside `prisma/migrations` will not be registered automatically.
6. Run post-release read-only SQL and in-browser acceptance checks: login/OTP, public clearance, payments, penalties, advances, remittances, reports, logs, and exports.
7. Resume jobs and writes only after invariants and service health pass. Keep the snapshot and original branch until stability is confirmed.

**Never run `prisma db push` directly against production to force this schema.** Do not merge PR #17 just because CI is green: the release requires validated production migration timing, staging UI checks and explicit permission for production DDL.
