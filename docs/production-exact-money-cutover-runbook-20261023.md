# CLEAR Production exact-money conversion — controlled cutover

**Status (2026-10-23): NOT CLEARED FOR PRODUCTION.** This procedure must not be initiated until every gate is verifiably satisfied. Linked candidate: [PR #74](https://github.com/engrken/CLEAR/pull/74).

## Scope

Convert **26 monetary PostgreSQL double-precision columns** to `NUMERIC(18,2)` with matching Prisma `Decimal @db.Decimal(18,2)`, coordinated web server, server-side mobile JSON/centavo adapters and concurrency integrity tests. **Penalty.hoursLate remains Float**. Existing receipt numbers, source row identities, fee policy, student links, NULL `Penalty.assessedAmount` and void status must not be rewritten.

## Hard blockers discovered 2026-10-23

- Neon `wandering-wind-73071792` rejects fresh branches with `branches limit exceeded`.
- Neon rejects fresh current-Production snapshots with `snapshots limit exceeded`. Existing `snap-wandering-tree-b3z8j1x9` is from October 22 and **cannot** be treated as the current recovery point.
- Existing staging `br-solitary-morning-b3amr5wy` has 9 applied migrations; current Production `br-calm-dew-b3vd1ira` has 11. No full source-data branch rehearsed yet.
- Until resolved: DO NOT pause Production, merge PR #74, apply DDL, remove backup branches or snapshots, or alter historical financial records.

**Preferred unblock:** raise Neon snapshot/branch capacity; do not delete backups without separately reviewed owner consent. The patch author must check the scope and account's capacity before proceeding.

## Required before-cutover evidence

- [ ] All GitHub financial, security, concurrency, Prisma migration, mobile API, typecheck, Next build, and preview deployment checks green at one immutable SHA.
- [ ] Verify exact Postgres monetary schema and matching Prisma generated client against the intended migration on a **fresh independent branch of present Production**. Reconcile migration history (11 currently + new migration), not just count.
- [ ] Create a new current-Production snapshot after writes are frozen; record exact snapshot ID and source branch ID; verify restore in a different isolated branch without finalizing or affecting Production.
- [ ] Capture per-tenant/per-period original centavo totals (and receipt status groups, OR uniqueness, cashier remittances, fund carry-overs, penalties, settlements, arrears, open collectibles, NULL assessments). Compare first/after using exact cents and no PII in public logs.
- [ ] Independently check receipt association anomalies: two unlinked legacy lines and three unmarked organization-level collectible rows. Do **not** automatically attach them to students or block harmless legacy rows.
- [ ] Prove all officer, tenant-admin, superadmin, student OTP and Android role gates against schema-compatible test data.
- [ ] Verify that mobile release already published remains able to read the same integer-centavo API response shape, and that Production mobile writes remain disallowed.
- [ ] Test database-restoration and previous web-deployment fallback on isolated staging. Confirm no concurrent posting, queue workers, external imports or Cron processes can write during lock.

## Production sequence — only after all gates clear

1. Record current Vercel Production deployment ID and main SHA, Neon branch ID, snapshot policy and current finance exception summary. Provide user-visible maintenance notice and confirmed rollback owner.
2. Quiesce **all** financial writes and new logins, including authenticated existing sessions and mobile API traffic. Vercel project's **Pause** action blocks the web deployment, not just the login button. Verify the real domain and representative API endpoints are inaccessible while maintenance is active. Block non-Vercel writers separately. If any write pathway is still reachable, ABORT and leave schema unchanged.
3. Create fresh Production Neon snapshot. Verify returned snapshot ID and run an isolated restore drill. If snapshot/branch quotas prevent this, **STOP**; unlock rather than start migration.
4. Immediately before migration, re-run the aggregate centavo/invariant preflight. Assert no source dataset changed between snapshot and DDL. Verify new versioned client build is already green.
5. Apply the reviewed `20261024000000_exact_money_numeric_18_2` SQL atomically via the approved migration executor, with exclusive controlled writer access. Do not use ad hoc `db push` or execute the offline ROLLBACK rehearsal in place of the versioned migration.
6. Verify all 26 physical column types, Prisma migration table checksum/history, unchanged record counts/OR identities and per-tenant/per-period sums in exact cents. Verify preserved nullable `Penalty.assessedAmount`, valid receipt signatures, remittance totals, and ledger net balances.
7. Deploy the exact same approved Prisma.Decimal-compatible web/API SHA. Verify server-side student lookup authorization and centavo mobile JSON response contracts in a restricted post-migration test window. If deployment fails, keep the app blocked and follow rollback.
8. Resume public domain and logins only after database reconciliation, authenticated smoke testing and verified app health succeed; monitor errors and official money writes in a controlled period. Give user the deployment SHA, snapshot reference and audit gate results.

## Abort / rollback requirements

At ANY failure, **do not unlock access to mismatched schema/client**. Keep the maintenance block active, restore the verified pre-cutover snapshot and previous known-good Vercel deployment, validate original 26 double-precision columns and receipt/fund centavo invariants, then lift the lock. If any out-of-band writer posted after the backup, abort the restoration until source-preserving replay is planned by the authorized officer; NEVER silently discard newly posted funds.

## Type and contract gates

- All reads of Prisma.Decimal used for React client props must convert through `lib/money-precision.ts`; do not serialize arbitrary Prisma.Decimal as JSON strings in an endpoint whose contract requires integer centavos.
- Money writes must be validated to two decimal places or fewer, use checked exact centavos for reconciliation, and preserve `NULL` assessment semantics.
- `scripts/finance-readonly-audit.mjs` provides aggregate-only live observations. It is not a posting/repair script. Production benchmarks must never invoke staging-only sample tooling on the real database.
- CI’s synthetic migration rehearsal alone does not substitute for the fresh Production-compatible restoration drill.

**Do not claim this migration completed merely because GitHub CI or Vercel Preview is green.**
