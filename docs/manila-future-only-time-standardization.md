# CLEAR — future-only Philippine time standardization

## Operator scope decision (2026-10-19)

The operator explicitly stated that existing database records are **test data** and accurate display of their historical event timestamps is not important. The release objective is therefore **correct timestamp semantics for all future events**. This is a waiver of historical *event-time accuracy only*, **not** permission to delete data, alter business dates, financial amounts, security settings, audit attribution or accounting records.

Verified historical evidence of mixed origins in `SystemLog.timestamp` remains documented in `docs/manila-legacy-timezone-evidence-2026-10-19.md`. The waiver does **not** make mixed historical values UTC. Do not claim a UTC-only historical conversion is accurate.

## Future time model

- Store new event instants in PostgreSQL `timestamp with time zone` / Prisma `@db.Timestamptz(3)`. UTC is the interchange/serialization time zone. PostgreSQL `timestamptz` identifies an instant; it does not persist the originally selected display zone.
- Render audit logs, collections event timestamps, reports, CSV, receipt notifications and other event times using explicit `Asia/Manila` formatters, regardless of browser/system timezone.
- Use PHT calendar boundaries for Philippine day/month/year filters and period defaults. Example: `2026-10-19 00:00 PHT` corresponds to `2026-10-18T16:00:00Z`. Use half-open `gte/lt` time ranges.
- Keep `Collection.date`, `Penalty.date`, `CashAdvance.dateIssued`, `CashAdvance.expectedReturnDate`, `Audit.date`, `CashierRemittance.date`, and `FundRealignment.date` unchanged. Those are accounting/calendar fields, not event timestamps.
- OTP expiration, sessions and lockouts must compare absolute instants, not add/subtract eight hours. A `datetime-local` form input must be explicitly parsed as PHT.
- Vercel's `0 19 * * *` cron means 03:00 PHT the next day. Validate scheduled execution behavior but do not assume jobs run at the exact minute.

## Legacy test timestamp treatment at schema cutover

The database contains mixed legacy local and UTC-naive event times. Since the operator accepts incorrect historical test times, a deliberately documented **future-only** type cutover can interpret all *old event-time fields* as UTC-naive when changing to `timestamptz(3)`, **solely to establish a clean schema for future inserts**. Some old local values will show up eight hours later in PHT. This does not fix historical data.

**Important:** The existing `scripts/sql/manila-event-time-migration.sql` explicitly requires verified UTC historical origin. That flag cannot truthfully be asserted for this mixed dataset. Before cutover, prepare a distinct **future-only test-data waiver guarded migration** with clear user approval, then rehearse on an isolated copy of production. Do not circumvent the existing guard by falsely claiming UTC provenance.

## Release conditions (no automatic production action)

1. Confirm the environment is still test/pilot data, or identify any records that are not disposable test events.
2. Freeze financial writes, authentication state changes, receipt delivery and scheduled jobs for the maintenance interval; align Vercel application deployment with DDL.
3. Create and verify a **fresh** Neon recovery snapshot of current production, and retain recovery branches. The operator explicitly waived the separate independent `pg_dump` backup and accepts reduced recovery options.
4. Capture pre-change records/counts, finance sums, accounting dates and audit ownership. Perform an expressly authorized migration on the **verified current `main` branch ID** only. Do not use `prisma db push`.
5. After conversion verify 33 event-time columns as `timestamptz(3)`, all financial aggregates, business dates, users, auth state and row counts unchanged. Historical clock *meaning* is waived, not data integrity.
6. Deploy the tested Manila feature application after DDL, check read/write workflows, then resume traffic and jobs.
7. Create **new** staging/production test events *after* the change and verify directly: an event at `2026-10-19 09:30 PHT` is the same instant as `2026-10-19T01:30:00Z`; audit display, CSV/receipt export, date filters and log downloads show `09:30 PHT`. Verify cross-midnight and year-rollover cases.
8. Separately reconcile Prisma migration-history tracking for the manually reviewed schema change. `prisma migrate status` only assesses recorded migrations, not arbitrary DDL.

Production DDL or Vercel deployment requires a **new, explicit operator authorization** after the correct future-only plan/script is reviewed. GitHub PR #17 stays draft until cutover is safely coordinated.

## Verified staging execution entrypoint

Reviewed SQL: `scripts/sql/manila-future-only-event-time-migration.sql`. The
obsolete UTC-provenance script `scripts/sql/manila-event-time-migration.sql`
is deliberately disabled to prevent accidental production misuse. A running
PostgreSQL SQL session must explicitly acknowledge the legacy TEST-clock waiver,
then invoke the future-only script in that same session. The migration refuses
already-partly-migrated columns, uses UTC for legacy type reinterpretation and
**does not change any accounting/calendar fields**. Production release is still
subject to explicit authorization and a fresh Neon snapshot.

Example for a fully verified, non-production connection:
```sh
psql "$STAGING_DIRECT_URL" -v ON_ERROR_STOP=1 \
  -c "SELECT set_config('clear.future_only_test_history_waiver','ACCEPT_INACCURATE_LEGACY_TEST_TIMES',false)" \
  -f scripts/sql/manila-future-only-event-time-migration.sql
```
