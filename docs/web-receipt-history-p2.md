# Web Receipt History — controlled P2 read-performance improvement

This change does not mutate any collection, receipt, OR sequence, or financial value.

## Improvements
- Normalize an exact package allocation OR (`OR-P02`) to its base receipt identifier **before querying and filtering**, ensuring the receipt is read as its complete allocation group, never a misleading single package line.
- Add **opt-in, privacy-safe timing** of SQL read and receipt grouping for authorized web Receipt History views. Disabled unless `CLEAR_PROFILE_RECEIPT_HISTORY=1` is set in a controlled staging environment.
- Metrics include query/grouping milliseconds and aggregate row/group counts only. Student names/numbers, ORs, tenant IDs/slugs, amounts, login identities, search text and tokens are never logged by this feature.
- Existing grouping-before-pagination, tenant/AY/term boundaries, inconsistent-money flagging and void treatment remain unchanged.

## Acceptance and performance baseline
1. Confirm 10/25/50/100 groups per page in isolated seeded staging with mixed legacy duplicate-base and current `-Pnn` allocation receipts, voids, reused cross-term ORs, anomalous money.
2. Run cold and warm controlled queries for **exact OR**, a **3+-character narrow search**, **broad filtered search**, and **all periods** on a representative *isolated* dataset. Capture ≥30 warm samples and report median/p95 independently for query and grouping; include requests per minute, record count and environment.
3. Compare baseline commit against this PR head using the **same disposable database**, avoid unbounded production load. An observed improvement must be measured; this change alone makes no p95 performance claim.
4. Verify authorization: unauthenticated, wrong org, missing `tab-payment`, inactive officer/tenant must fail without leaking student history. All filters, OR semantics, page boundaries and exact totals must match the baseline.
5. Verify authorized collection/receipt/void row counts and values before and after each test remain identical. Receipt resend action stays independently secured.
6. Verify no profiling information contains personally identifiable data or financial values. Do not enable `CLEAR_PROFILE_RECEIPT_HISTORY` broadly in Production until a privacy review and sampling plan.

Long-term scalable grouping/pagination without full broad reads remains tracked by issue #70; it requires group-aware SQL or materialized receipt projections and separate correctness benchmarks before deployment.
