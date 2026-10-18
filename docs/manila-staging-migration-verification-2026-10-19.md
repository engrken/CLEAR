# Neon staging migration verification — 2026-10-19 (PHT)

## Scope and isolation
- Neon project: `clear-sys-db`
- **Migrated staging branch only:** `clear-manila-migration-staging` (`br-wild-pine-b3qs4i8u`)
- Source/baseline: original `main` history preserved in Neon branch `br-wispy-queen-b3lm2qy0`.
- Live production default branch: `main` (`br-calm-dew-b3vd1ira`), **not modified**.
- Database: `neondb`.
- Reviewed migration: `scripts/sql/manila-event-time-migration.sql`.
- Execution: one Neon SQL transaction, explicit session-local UTC review acknowledgment, `SET LOCAL TIME ZONE 'UTC'`, 10-second lock timeout, 15-minute statement timeout, and the reviewed guarded `DO` block.
- **No production DDL, production data manipulation, or production Prisma push was performed.**

## Verified results

| Assertion | Result |
|---|---|
| Event-time columns converted to `timestamptz(3)` | 33 / 33 |
| All converted event-time columns still naive on production | 33 / 33 |
| Populated event-instant values preserved under assumed UTC interpretation | 956 / 956 |
| UTC date-time normalized fingerprints | Identical across all 33 fields |
| All table counts and non-event row-data fingerprints | 29 / 29 matched |
| Total table rows | 1,244 in source and staging |
| Financial aggregate amount checks | 15 / 15 matched |
| Business-calendar date columns unchanged | 7 / 7 |
| Production/default branch | Unchanged during migration |

Historical event example (nonidentifying): `SystemLog.timestamp` `2026-10-18 19:43:11.361` UTC, represented as `2026-10-19 03:43:11.361` in `Asia/Manila`. This remains the same absolute instant. Date-only columns `Collection.date`, `Penalty.date`, `CashAdvance.dateIssued`, `CashAdvance.expectedReturnDate`, `Audit.date`, `CashierRemittance.date`, and `FundRealignment.date` remain `timestamp without time zone`, with identical value fingerprints.

## Important limitations

- The equality tests **prove migration arithmetic preserves the original UTC wall-clock values**, not that every historical event was actually recorded in UTC. Reconcile real historical event times against external trusted clocks before production migration, especially any legacy manually entered timestamps.
- Staging is a point-in-time copy and does not receive subsequent production transactions.
- Successful GitHub CI also includes isolated Next.js build, TypeScript checks, timezone utility tests and disposable PostgreSQL migration rehearsal. Application end-to-end smoke tests against the **actual migrated Neon staging branch** are still pending.
- A Neon snapshot and snapshot restore verification exist; an independent native PostgreSQL `pg_dump` and restore must still be completed before production DDL.
- The prior snapshot restore finalized the production `main` branch identity. This staging migration did not touch branch routing. Do not use Neon snapshot Restore against production while evaluating this change.

## Production release gate

Do **not** merge/deploy the proposed Prisma schema onto production yet. Require independent timestamp-origin validation, native backup/restore rehearsal, staging UI smoke tests (auth, clearance, collection, penalties, advances, remittances, reports), review of migration and Prisma history tracking, and a coordinated deployment window. Preserve source financial records and perform after-release totals/digest reconciliation.
