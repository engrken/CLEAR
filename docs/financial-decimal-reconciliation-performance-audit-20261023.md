# CLEAR finance precision, legacy reconciliation and performance — controlled follow-up

**Date:** October 23, 2026 (Asia/Manila)  
**Status:** Audit tooling and guarded migration *rehearsal* in draft; no Production schema or financial-record modifications.  
**Related backlog:** #68 exact money, #69 historical reconciliation, #70 read performance, #64 web/mobile parity.

## 1. Verified Production data inventory — read-only

Source: Neon `clear-sys-db` project `wandering-wind-73071792`, current Vercel-linked Production branch `br-calm-dew-b3vd1ira`. Executed only `SELECT` aggregate queries. No student identities, account credentials, actual official receipt numbers or raw payment rows were exported.

- Exactly **27** Prisma `Float` fields: **26 monetary** and **1 time measurement** (`Penalty.hoursLate`, which must NOT be converted to money).
- Across all 26 monetary columns: **0 detected sub-cent rows**, **0 non-finite rows**, **0 values too large for `NUMERIC(18,2)`** using the audit thresholds.
- **108 nullable `Penalty.assessedAmount` rows** currently contain NULL; retain NULL semantics through any future migration. Never substitute zero automatically.
- **495 `Collection` allocation lines**, **264 issued-OR groups**, **77 multi-allocation receipts**, **0 groups with conflicting student references**, **0 mixed valid/void receipts**, and **0 OR numbers reused across periods** in the inspected state.
- **2 legacy receipt allocation lines have no `Collection.studentId` relational link**. These may be legitimate older records; **do not infer a student relationship from a name or amount**.
- **3 outstanding organization-level collectible rows lack a student assessment marker**; do not convert them into student arrears.
- **0 explicitly student-marked outstanding collectible rows**, **0 linked `ArrearPaymentLink` rows**, and **0 unlinked active penalty rows** at the observed snapshot. A zero does not mean missing historical obligations should be generated.

The report is a **snapshot**, not a continuing attestation. The counts will change with normal business activity. These checks do not certify fee policy or receipt-to-student ownership.

## 2. Decimal migration design and safety boundaries

**Current state:** `Float` columns remain unchanged in Production and in `prisma/schema.prisma`. PostgreSQL uses `double precision`, so the full application cannot safely be switched to `numeric` without synchronized Prisma type changes. The existing web/mobile monetary input gates validate two-decimal amounts and the legacy package summary allocator uses integer centavos.

**Implemented here:** `lib/financial-column-catalog.mjs` is the complete money-column inventory, `scripts/finance-readonly-audit.mjs` produces anonymous preflight counts, and `scripts/emit-decimal-rehearsal.mjs` generates all 26 `NUMERIC(18,2)` conversion statements **inside a transaction ending in `ROLLBACK`**. It fails closed if the Prisma Float inventory changes. The generated SQL is **never** under `prisma/migrations`, and is not part of web deployment.

A future synchronized Production migration requires:

1. Obtain a fresh schema-compatible isolated branch or approved snapshot restoration. The Neon account currently has a **branch-limit error**, so no new disposable branch could be created. Existing E2E staging `br-solitary-morning-b3amr5wy` has **9 applied migrations** vs **11** on Production as checked October 23. Do not run the DDL rehearsal there without first establishing full migration parity and a dedicated owner-approved rehearsal window.
2. Inventory every Prisma model, server action, mobile API serializer and generated TypeScript type. The proposed `Decimal(18,2)` replacements require explicit `Prisma.Decimal` conversions at application boundaries, consistent JSON centavos/pesos serialization and unchanged validation.
3. Reconcile original receipt amounts, sums and fees per organization, academic year and term; compare original and candidate Decimal amounts using exact decimal arithmetic, including 0.01 allocation and refunds/voids.
4. Review historical anomalies individually. Corrections, if authorized, require append-only compensating records and a human audit trail. Do not retroactively change original OR identities, receipt sequences, penalties or inferred student links.
5. Rehearse schema conversion, rollback/PITR and actual HTTP financial workflows with synthetic transactions; verify all existing security, concurrent payment, VOID and signed receipt integration tests.
6. Obtain a new snapshot, freeze financial writes for the coordinated cutover, and secure **separate explicit owner approval** for the migration. Do not run `prisma db push` on Production.

## 3. Read-only historical reconciliation

The audit identifies **candidate review categories**, not automatically erroneous records. Priority: inspect the two unlinked legacy allocation lines through authorized Receipt History, independently compare source-issued documents, and check the three unmarked organization-level collectibles against approved fee setup. Missing links must remain unlinked until a responsible officer verifies exact receipt/assessment identifiers. None are automatically written or voided by the script.

Reviewers should use the existing authenticated Receipt History `Inconsistent` filter for recognized sub-cent or conflicting receipt anomalies; other ambiguous cases require a supervised confidential workflow. Do not publish student names or original receipt numbers in GitHub issues.

## 4. Measured SQL performance baseline — isolated staging

Read-only `EXPLAIN (ANALYZE, BUFFERS)` on existing E2E staging, **one execution per query**; not website or mobile request latency:

| Representative SQL | Observed database execution time |
|---|---:|
| Current-period receipt allocations, ordered | **10.480 ms** |
| Current-period enrolled roster, limited 10 rows | **3.5 ms** (approximately) |
| Candidate student-marked collectible dues | **1.039 ms** |

These plans executed with small staging tables (approximately 497 receipt rows and 104 enrollments). Sequential scans can be cheaper than indexes on small tables. The results do **not** measure Vercel cold start, Prisma connection acquisition, server render, transfer or browser display and cannot substantiate a p95 site-speed claim.

**Implemented here:** the audit script has a separate isolated-branch microbenchmark mode that runs each SELECT with a warm-up plus 6 measured `EXPLAIN (ANALYZE, BUFFERS)` executions and prints **only query name and p50/p95/min/max execution milliseconds**. Using the tool locally requires a trusted isolated `DATABASE_URL`; no credentials are written to files by the script.

### Follow-up load/connection investigation

- Capture Vercel function TTFB/error rate in Preview and Production by endpoint, with no personally identifiable information or bearer token in logs. Verify Vercel function region against Neon `aws-ap-southeast-1` (Singapore).
- Profile Prisma connection reuse/pooling and server request waterfall; the intermittent slowness may occur outside the database execution interval.
- Add a group-aware **indexed** pagination plan for unrestricted Receipt History without silently splitting a multi-line OR or concealing cross-term ambiguities. Candidate indexes: `Collection(organizationId, academicYear, term, timestamp DESC)` and a case-insensitive lookup strategy after staging `EXPLAIN`; no index DDL has been applied here.
- Baseline p50/p95 **HTTP** latency under authenticated synthetic accounts and inspect cold vs warm; then re-run after any optimizations. Limit load tests to approved staging capacity.
- Neon SQL microbenchmark or a Vercel READY build alone is NOT sufficient evidence of an end-to-end speedup.

## 5. How to run (only with authorized database access)

```bash
# Supply DATABASE_URL securely in the process environment.
# Use a schema-compatible, isolated Neon branch for both:
CLEAR_DB_AUDIT_SCOPE=isolated node scripts/finance-readonly-audit.mjs
CLEAR_DB_AUDIT_SCOPE=isolated node scripts/finance-readonly-audit.mjs --benchmark

# Offline DDL generator; produces a transaction that always ROLLBACKs.
node scripts/emit-decimal-rehearsal.mjs > decimal-rehearsal-only.sql
```

Do not check in `.env.local`, connection URLs, generated SQL containing credentials, raw reports with PII, or scripts that bypass the read-only transaction. Production aggregate audit is allowed only with explicit `CLEAR_DB_AUDIT_SCOPE=prod-readonly`, and SQL benchmarks deliberately refuse that scope.

**Stopping condition:** No Production schema conversion, financial backfill, snapshot deletion, changes to student history or mobile release until documented reconciliation, role/UAT results and explicit cutover approval.
