# CLEAR coordinated financial Decimal cutover — operational runbook

**Status:** PREPARED / NOT EXECUTED. This is the approval/stop checklist for [PR #74](https://github.com/engrken/CLEAR/pull/74), not evidence of a completed Production conversion.

## Why this is coordinated

Prisma money fields switch from PostgreSQL `double precision` / Prisma `Float` to PostgreSQL `numeric(18,2)` / Prisma `Decimal`. Deploying only the schema or only the application can break payment, remittance, historical receipt, student-clearance and Android API calls. All **26 currency columns** migrate together. `Penalty.hoursLate` stays `Float`.

The exact migration is in `prisma/migrations/20261024000000_exact_money_numeric_18_2/migration.sql`. It has preconditions for non-finite, sub-cent and oversize values. It has a transactional `BEGIN/COMMIT` and must only run when a current recovery snapshot, a full rehearsal and the correct application release are available.

## Hard blockers observed 2026-10-23

1. Neon `clear-sys-db` branch creation returned **branches limit exceeded**.
2. Neon Production snapshot creation returned **snapshots limit exceeded**. The only available snapshot (`snap-wandering-tree-b3z8j1x9`) predates this cutover and cannot serve as a current backup.
3. Existing E2E staging has **9 applied migrations**, while Production has **11**. It is not a fresh Production data clone.
4. Vercel Production has a `DATABASE_URL` and a `DIRECT_URL`, but the only inspected Preview-scoped `DATABASE_URL` is branch-specific to `android-parity-integration`. **Do not assume PR #74 Preview points to a schema-compatible isolated database.**
5. Old Vercel deployment URLs, other writable Preview builds and mobile tokens might remain usable even if the new application proxy is locked. A Vercel environment variable on a new deployment cannot revoke access to old deployments or external database credentials.

**Never free branch/snapshot quota by deleting a protected recovery copy without an explicit selection and archival decision.** Obtain adequate Neon branch/snapshot capacity (or an independently verified encrypted offsite recovery artifact) first.

## Phase A — prerequisites and isolated rehearsal

- [ ] Establish verified current Production snapshot, record its immutable identifier, state and recovery runbook.
- [ ] Create a disposable **fresh Production-child branch**; verify the same 11 pre-cutover migrations and rows across all tenant-owned financial models.
- [ ] Apply exactly PR #74's 12th migration in isolation; verify `_prisma_migrations` integrity and all 26 `numeric(18,2)` columns with `Penalty.hoursLate` unchanged.
- [ ] Verify before/after centavo totals, receipt-group counts, nullables, fee setup, penalties, fund balances, remittances, voids, arrears, cash advances, audits and expenses per tenant and period. The comparison should be exact cents, not Float tolerances.
- [ ] Exercise all authorized financial actions against synthetic staging students and verify server-side tenant role checks, rollback, concurrency, history, signed receipts, student clearance and mobile read-only APIs.
- [ ] Confirm all GitHub CI jobs are green for the exact final head SHA. Vercel Preview app must explicitly use **this** fresh Decimal isolated branch. Never point Preview's writes at Production.
- [ ] Verify the maintenance page and fail-closed proxy under `CLEAR_MAINTENANCE_MODE=locked` with GET, mobile bearer routes, NextAuth, sign-in, existing session, Server Action and API POST tests.
- [ ] Pre-arrange a verified mechanism to **stop all prior Vercel deployments and connection credentials from accepting writes**, including already-issued sessions and mobile API routes; the proxy alone does not accomplish this globally.

## Phase B — Production lock and migration (only after Phase A passes)

1. Freeze new payments and all business writes across web, mobile, existing sessions and all reachable deployments. Show maintenance page; fail closed API and Server Actions. Verify rejected financial requests, **not merely login denial**.
2. Drain in-flight requests and verify quiescence. Obtain a **new current Production snapshot after the freeze**, verify the snapshot and recovery steps before any ALTER.
3. Record authoritative per-tenant/period centavo invariants and schema/migration hashes without exporting personal data.
4. Apply the verified, atomic numeric conversion once using the approved privileged cutover connection. Do not use `prisma db push`. Ensure migration history is recorded with the exact commit; never run it twice by hand.
5. Deploy the **matching** web/server and mobile API release against the migrated schema, *with maintenance still enabled*.
6. Run privileged synthetic smoke checks and compare receipt/ledger totals against the frozen baseline; verify nullability, nonnegative constraints, transaction & void semantics, all tenant boundaries and current policy.
7. Only after every check passes, restore application access, monitor errors and reconcile affected financial reports. Preserve all source ORs and historical links.

## Abort and recovery

- If any stage fails **before migration**: leave schema unchanged, repair issue in staging, then lift maintenance.
- If database migration transaction fails: expect the transaction to roll back; verify actual column types and migration history before restoring access.
- If application mismatch/error occurs **after committed conversion**, freeze writes again and restore from the verified **fresh cutover snapshot** (or execute a separately rehearsed matching rollback), together with the previous compatible web build. Do not simply redeploy the previous Float app onto a Decimal schema.
- If recovery point is missing, CI fails, Vercel preview database scope is unknown, or inability to isolate old writers persists: **STOP. Do not lock or convert Production.**

## Current work boundaries

User authorized coordinated conversion and a temporary login lock. This authorization does NOT change the requirement for a recovery copy, a correct staging rehearsal, and verifiable write isolation before Production mutation. This runbook introduces no live writes and no downtime by itself. Official Google Play Android distribution remains a separately signed release; the *server API* must be compatible at cutover.
