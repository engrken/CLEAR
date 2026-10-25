# Consolidated reference search and performance — October 25, 2026

**#65 native search:** The server now provides a strictly authorized GET-only endpoint
`/api/mobile/orgs/:org/reference-search?kind=receipts|void&q=...`.
Receipt search demands `tab-payment`; Void audit demands `tab-void`, both validated on every
request against an active tenant officer session. Student bearer/anonymous/cross-tenant tokens
are rejected. The Android app has a role-protected native search screen with reactive
450ms debounce. No financial write route, broad permission, receipt issuance, void or
payment mutation is enabled.

**#70 performance and integrity:** Receipt searches pre-select 120 matching allocation
references from active term in PostgreSQL, then load *all* lines for at most 40 base
official receipts, using existing audited `buildIssuedReceipts`. More than 120
matching lines, 40 receipts or 1000 allocations returns a descriptive 422 rather than
silently truncating accounting data. Missing, malformed or subcent historical records
remain explicitly Inconsistent with no invented total. Current term context is labeled;
tenant-wide VoidTransaction lacks a period column and is **explicitly labeled as such**.
Void search caps 50 entries. Original web Receipt History and Void Center remain available.

This reduces scope on narrow mobile search queries but does **not** replace full
web history pagination or establish p95 web latency (#70 remains open). No index DDL,
schema migration, local cached student data, API mutation, production finance record
edit or Play artifact is part of this patch.

**Verification:** one CI run for all source and isolated data checks, including
negative tenant/tab authorization, real sorted receipt groups and representative
Neon staging query timings before Production claims. On Android, test an officer with
tab-payment only, an officer with tab-void only, a user lacking both, cross-tenant
denial, void reason/reference, valid/voided/inconsistent OR groups, 3-char limit and
broad-search 422. The new native screen is source-only until the next approved signed
Play AAB; published v1.2.2 remains unchanged.