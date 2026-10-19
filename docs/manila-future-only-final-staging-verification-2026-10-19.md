# CLEAR future-only Asia/Manila final staging rehearsal — 2026-10-19 PHT

## Purpose and operator waiver

The operator confirmed that historical event timestamps are testing data, and their correct historical timezone is **not required**. New events must retain absolute UTC instants and render in `Asia/Manila`, while no financial or business date values change. The waiver covers **old timestamp display accuracy only**, not removal/reassignment of records.

## Isolation and applied SQL

- Neon project: `clear-sys-db` (`wandering-wind-73071792`)
- **New staging**: `clear-manila-future-only-final-staging` (`br-muddy-truth-b3rullka`), copied directly from live `main` at 2026-10-19 01:29 UTC.
- **Production (NOT MODIFIED)**: `main` (`br-calm-dew-b3vd1ira`), which continues to have all 33 candidate event columns as `timestamp without time zone`.
- SQL reviewed and rehearsed: `scripts/sql/manila-future-only-event-time-migration.sql`.
- The obsolete `scripts/sql/manila-event-time-migration.sql` is **disabled**, since the legacy UTC-history assumption is demonstrably false.
- The new script checks an explicit `clear.future_only_test_history_waiver` acknowledgment **in the same transaction/session**, validates that all 33 columns still use the old type, sets `SET LOCAL TIME ZONE 'UTC'`, then changes event columns to `timestamptz(3)`. It leaves business date columns untouched.

## Results (direct Neon SQL)

| Check | Result |
|---|---|
| Cutover without explicit waiver | **Correctly rejected** |
| Cutover WITH explicit test-history waiver | **Succeeded on new staging** |
| Event columns converted | **33/33** `timestamptz(3)` |
| Production columns remaining unconverted | **33/33** (correct; production untouched) |
| Total tables compared, excluding converted event fields | **29/29 row fingerprints identical** |
| Total rows after vs. production snapshot | **1,244/1,244 matched** |
| Existing non-null event timestamp values | **957**, original naive clock fields preserved as UTC wall values by the chosen waiver; original historical absolute instants NOT proven |
| Financial aggregate checks | **15/15 matched** |
| Accounting date field fingerprints | **7/7 matched** |
| Current collection amount total | **PHP 123,153.00** in source and new staging |
| New `SystemLog` event using database default | UTC `2026-10-19 01:35:22.697` / PHT `2026-10-19 09:35:22.697`, delta 0.000s from transaction's current time |
| Newly inserted test log persisted? | **No**: rolled back via staging SQL savepoint |
| OTP expiration semantic test | Exactly 300 seconds elapsed for five-minute expiration; timestamp formatted in PHT; changes rolled back |

Note: `CURRENT_TIMESTAMP` represents an instant independently of the SQL session display zone, so new defaults are correct once columns are `timestamptz`. This doesn't prove old data were UTC.

## Production release hold

The operator chose to skip an independent `pg_dump`; a pre-release **fresh Neon snapshot** is REQUIRED, and its restore must be planned to avoid unintended Neon `main` branch replacement. Existing recovery branches/snapshot must be retained.

**NOT YET DEPLOYED**: PR #17 remains Draft; production has not been migrated or changed. A coordinated maintenance interval is required (pause writes and jobs; capture final checksums and snapshot; execute this future-only SQL with explicit waiver on the correct live branch; validate types and finance records; deploy feature branch via Vercel; smoke-test *new* PHT events; resume writes). The application and Prisma `@db.Timestamptz(3)` schema should not be deployed before the database cutover.

Manual DDL is outside the Prisma migration ledger. Future Prisma history reconciliation must be explicitly planned; `prisma migrate status` alone does not prove database types.

**Next action:** Review completed GitHub CI (Types, timezone tests, full build, disposable database rehearsal) then request **separate clear production DDL/deployment authorization**. This staging rehearsal authorization did not modify production.
