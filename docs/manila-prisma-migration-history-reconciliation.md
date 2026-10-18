# CLEAR — Prisma migration-history reconciliation before production Manila Time release

**Status (2026-10-19): BLOCKING finding.** This is documentation and read-only discovery only: do not alter `_prisma_migrations`, merge the Manila PR, or run production `prisma migrate deploy` / `prisma db push` to "repair" history.

## What was checked

The connected Neon production database `clear-sys-db` / `main` / `neondb`, and the separate already-migrated staging database, each have **five successfully applied** Prisma migration rows in `public._prisma_migrations`:

| Migration name | In GitHub feature-branch migration directory? |
|---|---|
| `20261005040205_add_system_logs` | Yes |
| `20261006024331_add_active_term` | Yes |
| `20261016000000_sync_schema_drift` | **No** |
| `20261016104256_add_auth_throttle` | **No** |
| `20261016122213_add_mobile_sessions` | **No** |

The branch contains only the first two migration folders and `migration_lock.toml`. A GitHub directory-path commit history search did not find the missing three files. Do not assume that missing files were never used: the database has recorded them as applied.

Neon staging passed the manual, reviewed timestamp conversion against the real source-data copy (33/33 columns, 956 populated instants under the UTC assumption, 29 table fingerprints, 15 financial aggregates and seven accounting-date columns), but **that manual SQL was deliberately not recorded in `_prisma_migrations`**. This is distinct from the three missing historical migrations.

## Safe recovery workflow

1. On the actual CLEAR Windows workstation, in the repository root, run:
   ```powershell
   Get-ChildItem -Path .\prisma\migrations -Recurse -File | Select-Object -ExpandProperty FullName
   git status --short
   git branch --show-current
   ```
2. Search other local clones, offline backups or CI/build artifacts for the three **original** `migration.sql` files. Do **not** invent them or alter migration IDs/contents.
3. For each recovered original `migration.sql`, compute `(Get-FileHash -Algorithm SHA256 .\prisma\migrations\<folder>\migration.sql).Hash.ToLower()` and compare it against the corresponding DB record's `checksum`. Use a read-only query:
   ```sql
   SELECT migration_name, checksum, finished_at
   FROM public._prisma_migrations
   WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
   ORDER BY migration_name;
   ```
4. Verify recovered folders against applied history **on the isolated Neon staging branch first**. Never silently edit an already-applied migration.
5. If the exact files are irretrievable, plan and review a deliberate Prisma history **baseline/reconciliation** with a DB specialist. Do not create placeholder empty migrations or manually delete/rewrite applied production records to make `migrate status` green.
6. The Manila timestamp migration itself must eventually be represented through an approved migration-history procedure, or future `prisma migrate deploy` and schema diff workflows can become misleading. Do not put unguarded event-timestamp DDL into an automatically applied migration while historical UTC provenance is still under review.

## Evidence and release gates

- Latest feature-branch GitHub Actions timezone/type/isolated-build tests: green as of 2026-10-19; Vercel commit status green. Successful CI does not validate production Prisma migration ledger.
- Operator confirmed live migrated-staging application testing; details of acceptance scope are retained in `docs/manila-production-release-checklist.md`.
- Native independent dump/restore was declined in favor of a verified Neon snapshot and recovery branches. **A new Neon snapshot is required immediately before actual production change**.
- Production `main` retains legacy `timestamp without time zone` columns; do not release the new Prisma schema ahead of a controlled DDL and coordinated app release.
- Historical event timestamps must be proven to have been recorded as UTC, particularly for older records or any manually entered/imported timestamps. Neither arithmetic equality nor server timezone alone proves provenance.

**Next action:** Recover or explicitly reconcile the three missing migration scripts from the local workstation, then perform documented staging-only Prisma history checks. Production migration and release remain blocked pending separate explicit authorization and a maintenance/rollback plan.
