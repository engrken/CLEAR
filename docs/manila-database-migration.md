# CLEAR — production timestamp migration protocol

## What this branch changes
The Prisma schema marks 33 **event-instant fields** as PostgreSQL `timestamptz(3)`; calendar-only fields retain existing `DateTime` mappings. The matching SQL is intentionally kept in `scripts/sql/manila-event-time-migration.sql`, **outside Prisma's auto-executed migration directory**, to prevent accidental application to data whose historical timezone cannot yet be proven. Do not use `prisma db push` on a production database before the migration is reviewed.

## Preconditions
1. Take a verified complete database backup and successfully restore it in a staging environment.
2. Run `scripts/sql/manila-time-preflight.sql` against the real database and save the nonsecret results.
3. For each event field, confirm that its legacy `timestamp without time zone` values represent **UTC wall-clock instants**. This must be determined from application history, trusted timestamps, database defaults and representative samples. A displayed value alone cannot prove it.
4. If any field is Manila-local, mixed, or ambiguous, do **not** execute the script. Split it by affected columns and use correct source timezone or per-row reconciliation.
5. Run a database snapshot rehearsal, verify original instants and row counts, and test the authentication and finance workflows with real anonymized records.
6. At release time stop write traffic, rerun the backup and preflight, execute the approved migration, deploy the Prisma schema and application build together, then compare record totals and historical event times.

## Deployment SQL
Run in an authenticated SQL client where a PostgreSQL session is kept for both statements. After verifying UTC legacy history:

```sql
SELECT set_config('clear.verified_legacy_timestamp_zone','UTC',false);
-- Then execute scripts/sql/manila-event-time-migration.sql in the SAME SESSION.
```

Setting that flag is an acknowledgment, **not automatic proof**. The script wraps changes in a transaction, aborts on unexpected column types, and uses `AT TIME ZONE 'UTC'` to preserve the original instant rather than add eight hours. Existing `timestamptz` columns are left unchanged.

## Excluded calendar fields
`Collection.date`, `Penalty.date`, `CashAdvance.dateIssued`, `CashAdvance.expectedReturnDate`, `Audit.date`, `CashierRemittance.date`, and `FundRealignment.date` represent business/calendar labels or have ambiguous historical encoding. Do not reinterpret as an instant or convert them in this migration.

## Verification
A newly logged event at `2026-10-19 00:15:00 PHT` has the identical instant `2026-10-18T16:15:00Z`; the database should store that instant in a timestamptz. UI, emails, CSV and queries should show PHT. Never modify OTP/session TTL arithmetic to use shifted timestamps. Verify every original financial transaction amount, academic year, term, date label and audit user remains unchanged.

**Status:** Proposed migration, not applied to production; activation is blocked pending live data evidence.
