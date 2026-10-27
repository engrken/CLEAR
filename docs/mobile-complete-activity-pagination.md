# CLEAR complete mobile Activity — next consolidated Android release (#106)

## Scope and version compatibility
This is an **unreleased** source-only Android/Web API improvement, stacked on PR #101. Published Play Android **v1.2.4** remains unchanged. The old `GET .../ledger` endpoint returns a `LedgerEntry[]` (100 default, 200 max); no backwards-incompatible change is made to that route.

New additive endpoints:
- `GET /api/mobile/global/orgs/:org/ledger/page?scope=all&limit=50&cursor=...`
- `GET /api/mobile/orgs/:org/ledger/page?scope=active&limit=50&cursor=...`

Response: `{ records: LedgerEntry[], nextCursor: string|null, hasMore: boolean, scope: "all"|"active", pageSize: number }`. `scope=all` includes all academic periods for Global Administrators and tenant officers with explicit reporting access (including Administrator). Ordinary officers with only `tab-overview` can page through their complete active term using `scope=active`; they cannot use another cursor or alter `scope` to gain historical access. The cursor is opaque to clients and bound to the tenant, active-term values, scope, event timestamp and stable record ID. Every page separately rechecks its bearer-session role and tenant grants. A changed academic period invalidates the old cursor (refresh required). The server never returns an unbounded collection or any financial mutations.

The first page loads 50 rows; **Load older Activity** requests subsequent bounded pages. Web and mobile exact-centavo integrity is unchanged: a record containing invalid money on the requested page fails with HTTP 422 `financial_data_review`, rather than silently replacing a value with zero or misrepresenting a partial page as complete. Legacy penalty reconstruction comes from PR #101. Voided Collection entries are distinct from the separate `VoidTransaction` audit trail; zero JIECEP void records is an expected valid empty state.

## Guarantees and known limitations
- Sorting: event time DESC, source category ASC and immutable record ID DESC. Tied timestamps across five tables are deterministic.
- Per-table queries use index-friendly date/id ordering and bounded `take=pageSize+1`; a merge of all five top lists yields the next combined page. A first-page timestamp watermark prevents **newer** appended activity from displacing older pages during navigation.
- Backdated inserts or updates to historical date/status while the user pages can alter the active history. No long-lived database snapshot is promised. Refresh to restart. Ledger source financial event ordering is defined by existing record event timestamp, not a newly allocated synthetic chronology.
- Local search and filters apply only to **loaded** pages; the UI labels this transparently. Later server-side cross-history search can be added with bounded permission-aware queries without downloading all history.
- Existing dashboard requests remain limited and lightweight. No bulk load on initial login, no private-data offline cache, no Play signing or deployment, no production finance DB writes.

## Release gates
1. All required CircleCI web/mobile/financial-security jobs; isolated PG HTTP integration with 555 synthetic records across periods, 50-row pages, same-timestamp ties, invalid cursor, cross-tenant/role negatives, 422 tests inherited from PR #101.
2. Verify account/tenant switching, Refresh, Load older, search/filter, zero-void state and history completeness on physical Play Internal Testing device.
3. Merge PR #101 first, then rebase/retarget this stacked PR to `main`. Include Android UI only with the **single future consolidated Android AAB** after PR #96 source release reconciliation and owner acceptance.
