# CLEAR v2.4 — Production-aligned migration-history reconciliation

**Status: draft PR #35. No migration is authorized on Production.**

## Source of truth and scope

Production Neon `clear-sys-db`, original branch ID `br-calm-dew-b3vd1ira`
(currently named `clear-v24-prod-snapshot-restore-drill-20261020 (1)`),
was inspected read-only on 2026-10-20. **Identify Production by branch ID**:
the Neon branch currently named `main` is restored copy
`br-aged-firefly-b3fcx8f9` and is **not** live Production. Its live table columns, PostgreSQL
types, defaults, primary/foreign keys and indexes were compared with the
eight committed Prisma migrations and `prisma/schema.prisma`.

Existing Production contains features added historically via `prisma db push`
or manual schema changes that cannot be recreated by `prisma migrate deploy`
alone. The new migration `20261020150000_reconcile_production_schema`
documents those existing structures; it is guarded to avoid recreating
objects already present in Production and staging.

### Changes

- `Organization`: school group, tier, status, modification timestamp and
  branding fields with Production's existing `VARCHAR(255)` constraints.
- `Penalty`: assessed amount and type. `TenantUser`: OTP attempt, request
  count, and last request time.
- Six existing Production tables absent in old migrations:
  `AcademicPeriodConfig`, `AcademicPeriodTransition`, `ArrearPaymentLink`,
  `PenaltySettlementEvent`, `DigitalReceiptDelivery`,
  `TransactionEmailPreference`. Preserve their production-derived
  definitions, indices, unique constraints and FK delete behavior.
- Time-zone-aware event/OTP dates are converted on **empty legacy tables
  only**. If any legacy table is populated, conversion aborts with an error
  and requires a manually reviewed data-preserving migration instead.
  Production is already `TIMESTAMPTZ(3)` for these event fields.
- Business dates remain `TIMESTAMP(3)` without time zone
  (for example `Penalty.date`, `Collection.date`, and
  `CashierRemittance.date`). Never silently reinterpret historic dates.
- `GlobalSuperAdmin.updatedAt` keeps its production
  `CURRENT_TIMESTAMP` default; Prisma model annotations reflect it.
- Receipt sequences and payment-request migrations from PR #35 are unchanged.

## Release gates and implementation instructions

1. Keep PR #35 **draft**. No Production DDL, `prisma db push`,
   `prisma migrate reset`, or `prisma migrate dev`.
2. Inspect GitHub Actions: `Prisma migration rehearsal` uses its own
   disposable PostgreSQL. It applies the entire migration history, compares
   the resulting schema against `schema.prisma`, repeats the bridge after
   adding a synthetic record, and checks timestamp type invariants.
3. Test the bridge migration on a **new Neon branch forked from Production**;
   compare row counts, receipts, important date columns and schema metadata
   before and after. Never experiment on the original Production branch.
4. Repeat staging verification with full application financial workflows
   and check the latest Preview deployment uses staging `DATABASE_URL`.
5. Validate backups and secure credentials before asking for **separate user
   approval** to merge/deploy and migrate Production.

Use PowerShell `npx.cmd` on Windows. Only when a target isolated database
has been verified using host, branch and recent snapshot:

```powershell
git branch --show-current
git log -1 --oneline
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
```

The PowerShell `DATABASE_URL` variable can be overwritten by local `.env`
fallback when removed. Never share credentials. Once Production release is
approved, order work as: tested backup → migrations → schema/status checks →
application deployment → transaction monitoring. A `migrate deploy`
success message **does not alone prove schema equivalence**.

Existing migration files must not be edited or renamed. Receipt sequence gaps
after a rollback are normal and must not be reused.
