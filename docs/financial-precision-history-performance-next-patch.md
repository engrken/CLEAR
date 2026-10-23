# Next patch: shared financial precision, historical integrity and fetch latency

**Status:** staged source changes and release runbook; not approved for Production or Google Play.
**Scope:** authenticated CLEAR web financial summary, server-side mobile financial summary, read-only student historical obligations, and issued receipt-history lookup.
**Source of truth:** existing Neon Production records and authoritative server financial rules. Never regenerate, renumber, delete or silently reallocate previously posted OR/ledger rows.

## Phase A — low-risk code refinements (this PR)

1. Web `getDepartmentFinancials` and mobile `computeDepartmentFinancials` use the same `allocateLegacyPackageCents` helper to distribute a legacy single-line package in **integer centavos** (largest remainders; stable fee ID ordering). Read-only summary portions now add up to the exact source amount. This **does not rewrite an OR or change a posted fund balance**. Test ₱0.01 remainders, unequal rates, split package receipts, old and new packages, reversed/voided ORs and full package fees.
2. Both financial engines select only the student's ID, school number and full name instead of retrieving unused roster fields. Role and tenant checks remain server-side; payment and VOID code is untouched.
3. The shared historical arrears query restricts candidate collectible records to the **already-recognized** `|SID:` marker and selects only required columns. Unmarked organizational collectibles are **not automatically attached to a student**. Prior-period fines and existing legitimate debts remain enforceable.
4. The web Receipt History exact-OR filter is pushed into the database while retaining both same-base legacy allocations and `-P02` suffix lines; grouping, full OR reconciliation and pagination remain authoritative. All-period, free-text and inconsistency searches still fetch all matching period lines until Phase C.
5. Historical receipt grouping flags unsafe/sub-cent amounts as **Inconsistent** for authorized audit review. It does not round and persist bad data. No student names or OR numbers may be emitted by optional performance diagnostics.

## Phase B — controlled exact currency migration (separate reviewed change)

Existing Prisma `Float` monetary columns span Collection, CollectionSetup, CashAdvance, Audit, Penalty, Collectible, Fund, FundTransfer, FundRealignment, CashierRemittance, OnlineRemittance and other financial tables. Changing schema types now without exhaustive consumers/migrations risks payment, rollover and refund integrity.

- Inventory exact monetary fields and distinct non-currency measurements (e.g., `Penalty.hoursLate`) separately; preserve existing column names, constraints and OR uniqueness.
- On an isolated schema-compatible Neon restore, **audit first**: count null/nonfinite/sub-cent/out-of-safe-range values by table and period, verify every source row and source-to-receipt/ledger reconciliation. Never silently coerce an anomaly or assume rounding is approved.
- Agree on `Decimal(18,2)` vs integer centavos per column, Prisma-generated types, JSON serialization, and web/Android response compatibility; enforce exact centavo parsing at every write boundary.
- Design a guarded migration with before/after per-tenant/per-period sums and a tested rollback/restore plan. Reject and document drift, legacy anomalies, duplicate OR associations or cross-tenant mixes; request explicit human resolution of ambiguous cases.
- Rehearse all financial actions and reports using synthetic fixtures and an approved isolated branch, plus payroll-like edge cases: pennies, split packages, 0 payment, void/return, remittance, penalty, carry-over, and closed periods. Do not backfill original payment events from an inferred link.
- Production cutover requires independent snapshot, migration review, no active posting window, reconciliation proof, role/tenant verification and explicit owner approval. **No DB type change in Phase A.**

## Phase C — measured web/mobile read performance

Observed source-level risks are NOT yet latency benchmarks. Prioritize:
1. Receipt History fetches all allocation lines before group/filter/page; this protects true OR grouping but scales with transaction count. Design a **receipt-group-aware** indexed query with full-group fetch, accurate count, cross-period collision detection and equivalent filters. Do not replace it with naive `take/skip` on Collection allocation rows.
2. Students roster currently does 3 counts plus 1 paginated search; review indexes and conditional counts with real `EXPLAIN (ANALYZE, BUFFERS)` on synthetic restored staging data. Do not remove tenant, year, or status filters.
3. Web and mobile financial summaries load ledger inputs and then period ledgers; profile read-only query timing and avoid duplicate loads only if results remain exact. Never cache private student, OTP, clearance or financial balances across principals/tenants; if caching is proposed, define invalidation on all mutation paths before enabling.
4. Check Vercel function region relative to Neon Singapore (`aws-ap-southeast-1`), pool/cold-start overhead, server-side render timings, and slow/unindexed queries. Do not rotate database URLs or production connection settings as an unreviewed optimization.
5. Measure warm/cold **p50/p95** and DB query duration on staging across Dashboard, Students, Receipt History, Void Center, and verified student clearance; test 10/25/50 concurrent sessions only after load-test scope and quotas are approved.
6. Diagnose response size, pagination, server-side search and client debounce on web and mobile; uphold standing [parity policy #64](https://github.com/engrken/CLEAR/issues/64).

**Target acceptance metrics (proposed, not measured):** aim for p95 warm authenticated page data retrieval under 2 seconds on representative workloads and no regression in server-side authorization, finance totals or response payloads. Confirm actual baseline before approving targets.

## Staging/approval gates

- [ ] Bring isolated test schema into parity: README previously recorded staging 9 migrations vs Production 11. No `prisma db push` on Production.
- [ ] Run `npm run test:finance`, `npm run test:mobile-roles`, `npx tsc --noEmit`, `npm run build`, mobile typecheck and related GitHub CI.
- [ ] Compare web/mobile summary amounts, OR counts, legacy package allocations, fines, historical arrears, voids, rollovers and authorized read-only data.
- [ ] UAT exact OR vs suffix, all-period OR collisions, void/inconsistent filters, older-period records and open/non-enrolled identities with synthetic accounts.
- [ ] Verify no write endpoints or migration invoked from either client, and that Vercel Preview `READY` is not treated as passing privacy or correctness tests.
- [ ] Reviewer approves merged web patch; Vercel Production smoke-test separately. Android changes remain in source until the consolidated Rupert-compatible officially signed major Play update (#61).

## Rollback

Phase A is source-only, so revert the PR/deployment if regressions occur. Legacy ORs and balances are unchanged. Phase B will require its own point-in-time snapshot and migration-specific recovery rehearsal before proceeding.
