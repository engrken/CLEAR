# Asia/Manila standardization — staged rollout

The CLEAR application must use the IANA time zone `Asia/Manila` (UTC+08:00) for user-facing timestamps, calendar-day defaults, receipts, exports, and reporting. Actual event instants and OTP/session expiries remain absolute UTC timestamps.

## Implemented in this branch

- Shared `lib/clear-timezone.ts` with environment-independent date formatting, date input defaults, and Manila day boundaries.
- Manila-time audit log display and CSV timestamps, retaining original event instants.
- Manila calendar-day defaults on financial forms.
- Consistent Manila renderings for selected transaction histories, printable dates, penalties, and remittance queue.

## Not yet safe to deploy as full database migration

The `main` branch originally used unannotated Prisma `DateTime` columns, which commonly map to `timestamp(3) without time zone` under PostgreSQL. This feature branch now marks 33 true event-time fields as `@db.Timestamptz(3)` and provides a staged, review-gated SQL conversion in `scripts/sql/manila-event-time-migration.sql`. These SQL changes have **not been run on production**. Review actual database column types, historical timestamp meanings, and a verified backup FIRST. See `docs/manila-database-migration.md`.

Run these **read-only** queries in the target production database:

```sql
SHOW TIMEZONE;

SELECT table_name, column_name, data_type, datetime_precision
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('timestamp without time zone', 'timestamp with time zone', 'date')
ORDER BY table_name, ordinal_position;

SELECT CURRENT_TIMESTAMP AS clock_instant,
       CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' AS manila_clock;

SELECT "timestamp", COUNT(*)
FROM "SystemLog"
GROUP BY "timestamp"
ORDER BY "timestamp" DESC
LIMIT 10;
```

For each field classify:
1. **Event instant**: logs, exact payment submission time, user/session expiry, audit event creation; use `timestamptz(3)` after audit and migration with explicit `AT TIME ZONE 'UTC'` *only if historical values are proved UTC*.
2. **Business calendar date**: transaction date, issue date, accounting date, expected return date; do not shift historical values; decide on `date` and a dedicated data migration after application consumers are reviewed.
3. **Existing noon-UTC encoded date-only**: retain until all consumers have been migrated; do not automatically change to midnight PHT.
4. **Derived or external time**: store source event instant and separately preserve the original externally reported date where required.

Never use `timestamp + interval '8 hours'` or globally change `process.env.TZ` as a data migration.

## Database migration staged (requires live-data inspection)

A migration rehearsal using an isolated PostgreSQL test database verifies the conversion pattern below, but does **not** prove the source timezone of real CLEAR records. If a column is confirmed to store UTC wall-clock timestamps without time zone:

```sql
-- EXAMPLE ONLY: not a production-ready migration.
-- Postgres converts explicit UTC wall-clock values to the same real instant.
ALTER TABLE "SystemLog"
  ALTER COLUMN "timestamp" TYPE timestamptz(3)
  USING "timestamp" AT TIME ZONE 'UTC';
```

If historical data instead contains Manila wall-clock times, its correct conversion is different (`AT TIME ZONE 'Asia/Manila'`). Mixed history requires per-period or per-row remediation. Prisma field types must match the verified SQL migration.

For SQL reporting, `timestamptz_column AT TIME ZONE 'Asia/Manila'` provides a Manila wall-clock value. Session-level timezone settings are optional and must not replace explicit application conversion.

## Verification gates

- Verify `npm run build` and TypeScript checks in an environment with dependencies installed.
- Confirm current-day defaults immediately before and after **00:00 PHT**.
- Confirm CSV dates, printed receipts, and audit logs across a UTC-date boundary.
- Confirm clearance and academic-period cutoff semantics independently.
- Confirm OTP TTL, cooldowns, lockouts, signed-cookie expiry and mobile session expiry remain unchanged.
- Verify historical row counts, identifiers, financial balances and original instants before and after any schema migration.
- Test a reversible migration against a restored database snapshot, then schedule production DDL separately.

GitHub Actions now runs timezone tests, Prisma validation, TypeScript checking, an isolated Next.js production build, and an ephemeral PostgreSQL historical-timestamp conversion rehearsal. No database credentials, actual database values, or secrets are included here.
