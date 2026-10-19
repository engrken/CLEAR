# CLEAR — Prisma migration history recovery

**Status (2026-10-19): Original historical migration files RECOVERED.** This resolves the previous missing-file discrepancy; it does **not** authorize production deployment or database migration.

## Confirmed source

The original SQL files were located in GitHub branch `sync/vps-mobile` (commit `7b141ed679f838240b0d324f7c1c69797f4f2ac6`). All three originals have now been copied **unchanged** into the Manila Time feature branch at their canonical `prisma/migrations/<name>/migration.sql` locations.

| Applied migration | Recorded SHA-256 checksum | Original file recovered? |
|---|---|---|
| `20261016000000_sync_schema_drift` | `6e9ab9d3d125c8bc9d852c6d50cf6b9e347691388a38fede1cd954523bd5b5b8` | Yes — exact match |
| `20261016104256_add_auth_throttle` | `87e4aaf9bb78a77c135eae42b0ffb8510fa0b7b049c36f9d784e3be925aa8c21` | Yes — exact match |
| `20261016122213_add_mobile_sessions` | `ea9ded4974134efab787db864b96545d16ad825888a1ca5385455f2a8d24eeb0` | Yes — exact match |

Checksums were computed against the fetched original GitHub bytes (UTF-8) using PostgreSQL `sha256` in a **read-only query on the separate staging database**, and compared with the existing `_prisma_migrations.checksum` rows. **All three matched.** Original migrations `20261005040205_add_system_logs` and `20261006024331_add_active_term` remained in the repository already.

Importantly, `20261016000000_sync_schema_drift` states explicitly that affected tables had previously reached production through `prisma db push` and this migration was marked applied with `prisma migrate resolve --applied`. **Never re-execute that historical SQL** on an already initialized production database.

## Additional unapplied migration intentionally excluded

Branch `sync/vps-mobile` also contains `20261017120000_saas_tenancy_and_otp_cap`, but this name is **not present** in the production or staging `_prisma_migrations` history. Its statements are idempotent `ADD COLUMN IF NOT EXISTS` operations. Because adding its directory to this feature branch could cause an unexpected future `prisma migrate deploy`, the SQL was **not imported**. Review it separately for later migration bookkeeping; do not mark it applied without reviewing the schema and proposed SQL.

## Remaining checks

1. Pull the updated feature branch to the local workstation.
2. Point the locally invoked Prisma CLI **only at the staging Neon database**, not the production `DATABASE_URL`. Check the env scope before proceeding, and run `npx prisma migrate status` to compare recovered local migration folders with the staging migration ledger. This is a read-only status operation; do not run `migrate deploy` or `db push`.
3. The Manila Time event-column DDL was executed on staging as guarded manual SQL and **has not been recorded as a Prisma migration**. Migration-status success would not prove the migration's type changes or ledger integration. Prepare a reviewed, guarded approach to the Manila migration's future Prisma bookkeeping without replaying timestamp conversions.
4. Independently establish that historic event columns use UTC wall-clock representation; some old records may need special treatment.
5. Keep the confirmed staging functional testing, snapshot recovery evidence and financial invariants. The operator declined a native PostgreSQL dump. Take a fresh Neon recovery snapshot at the actual production release window, with explicit control of restore finalization/routing.
6. Production migration, merge and deployment remain on hold until those gates and separate authorization are satisfied.

**No production database writes, Prisma migration ledger changes, or `main` branch changes were made by the historical-file recovery.**
