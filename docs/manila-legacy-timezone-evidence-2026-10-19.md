# CLEAR — Legacy timestamp timezone forensic evidence (2026-10-19)

**Release decision: STOP the UTC-only production migration.** This file records newly recovered evidence from the operator-provided legacy Google Apps Script `LIVE_code.gs`, from current CLEAR application/import code, and from **read-only** Neon production queries. It does not modify production data.

## Old Google Apps Script evidence

The provided `LIVE_code.gs` (4,037 lines, privately supplied, **not copied into GitHub**) includes:

- `installDailyBackupTrigger()` creating a time-based trigger with `.atHour(3).nearMinute(0).inTimezone('Asia/Manila').everyDays(1)`.
- `createDailyLedgerSnapshot()` naming Google Drive snapshots using `Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd_HHmmss')`, then logging `DAILY_BACKUP`.
- `logSystemAction()` writing an Apps Script **Date object** to the Google Sheet: `logSheet.appendRow([new Date(), user, action, details])`.
- `handleRecordPayment()` writing a `new Date()` value as the first field (Collection.Timestamp) in the `Collections` sheet.
- Other legacy sheets with date/event columns include `FundTransfers.Timestamp`, `Enrollments.Last Updated`, and `OnlineRemittances.Timestamp`.

The `new Date()` object represents an instant inside Apps Script, but export to a spreadsheet/Excel numeric date and reimport to a timezone-naive PostgreSQL field can lose the original timezone interpretation. Thus the source code alone does not prove how all migrated database rows are encoded.

## Forensic matches in Neon production

A read-only query on `main` matched `SystemLog.action='DAILY_BACKUP'` against the date/time encoded in each log's `SNAPSHOT_*_yyyy-MM-dd_HHmmss` title:

- **24/24 legacy logs** matched the **same wall clock** encoded explicitly as `Asia/Manila` in the old script, within 15 seconds of the backup name. Average offset: **5.01 seconds**.
- The old backup job ran around 03:05 for 23 of 24 observed executions, as the operator also confirmed.
- Example: legacy snapshot suffix `2026-10-11_030445`; log column `2026-10-11 03:04:49`. This strongly establishes legacy `DAILY_BACKUP` rows currently preserve **Manila local wall-clock** values as naive DB timestamps.
- The **new** `AUTOMATED_DAILY_BACKUP` entries on Oct 17–18 refer to Vercel Blob filenames ending in explicit ISO UTC `Z`, and their DB log clock values match within seconds; these entries are **UTC wall-clock** naive timestamps.
- Therefore `SystemLog.timestamp` contains demonstrably **mixed historical clock origins**. Casting all values `AT TIME ZONE 'UTC'` gives an 8-hour misinterpretation of legacy `DAILY_BACKUP` events.

Additional supporting evidence:
- Legacy `SystemLog.action='recordPayment'` has 16 entries; **14/16** match `Collection.timestamp` rows in the same tenant within 10 seconds (mean absolute difference for matched events ~1.056s). This corroborates that the old payment and audit timestamps share a source recording method; it is not independent proof of the origin of **every** collection row.
- Neon organization with imported legacy history has 470 collection records (Sep 3–Sep 17). Other tenants also contain separate transaction histories, which must be classified separately, not strictly by date.
- GitHub `main` includes `seed-excel.js`: it imports `SystemLogs.Timestamp`, `Collections.Timestamp`, and `OnlineRemittances.Timestamp` via `parseDate()`. When input is an Excel serial number, its code uses `new Date(Math.round((val - (25567 + 2)) * 86400 * 1000))`, which interprets the spreadsheet's numeric wall clock in UTC without asking for the source spreadsheet timezone. This is a **plausible mechanism**, not independently confirmed as the exact import path of every existing row.
- Legacy accounting/calendar labels (e.g. `Collection.date`, `Penalty.date`) are separate and must **not** be shifted.

## Consequences for the staged migration

The guarded `scripts/sql/manila-event-time-migration.sql` used in the initial staging rehearsal interprets **all 33 legacy timestamp columns as UTC**. Its earlier checksum verification of 956 populated timestamps proved preservation of the original **UTC-labelled wall-clock fields under that assumption**, *not* the correctness of historical absolute instants.

**Do not use that SQL on production. Do not merge or deploy the Prisma `@db.Timestamptz(3)` rollout while source classification is unresolved.**

Corrected migration design requirements:

1. Build a read-only, source/field-specific inventory of event-time data, separated by tenant, original creator/import mechanism, and period, including `SystemLog.timestamp`, `Collection.timestamp`, `OnlineRemittance.timestamp`, `Enrollment.lastUpdated`, and all remaining candidate fields.
2. Establish defensible classification for each affected **row**, not only global column type or arbitrary calendar cutoffs. For explicitly proven legacy Manila-local rows use `timestamp AT TIME ZONE 'Asia/Manila'`; for UTC-naive rows use `timestamp AT TIME ZONE 'UTC'`. Stop and seek more evidence for unknown/mixed classes.
3. Draft a new guarded migration and test using a **fresh isolated branch copied from unconverted production/source data**, not by pretending that the UTC-only migrated staging values were already correctly classified.
4. Compare expected UTC instants and displayed PHT against source timestamps, old backup titles, and transaction references. Verify accounting dates, financial sums, every table row count, and audit attribution.
5. Coordinate a new production snapshot, maintenance window, schema conversion and feature-branch deploy only after a separate explicit authorization.

The operator opted to skip a separate `pg_dump`/restore; Neon snapshots and original history must be retained. A prior Neon snapshot restore accidentally finalized and reassigned the default production branch: **never invoke a restore expecting a non-finalized branch without passing `finalize: false` and confirming behavior.**

**Status:** Documentation only. No changes made to Neon production or existing staging data as part of this investigation.
