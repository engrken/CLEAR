# CLEAR web — consolidated patch acceptance checklist (23 October 2026)

**Scope:** Production web patch combining [#71](https://github.com/engrken/CLEAR/pull/71), [#62](https://github.com/engrken/CLEAR/pull/62), [#63](https://github.com/engrken/CLEAR/pull/63), and web roster optimization [#72](https://github.com/engrken/CLEAR/pull/72). The user will test once code deployment completes and consolidate observed defects. Android Play release is separate.

**Safety:** Use an authorized school/department account and a verified student *test identity* when possible. For any action that can post a payment, VOID, remit or edit Production academic records, **inspect without submitting**. Do not use another student's personal data, public screenshots of OTPs, or real monetary test writes. Financial correctness is checked using existing records and approved synthetic staging fixtures.

## Verify deployed version before testing

- Confirm Vercel **Production READY** for the most recent `main` SHA and working [CLEAR production web](https://clearsys.vercel.app). A Preview URL alone does not indicate a deployed patch.
- Check desktop and mobile browser viewports, reload and navigate between pages. Browser console errors, blank screens, repeated spinners and permission errors are defects; note route, role and timestamp.
- Clear the versioned tutorial key for a **test browser only**, not personal site data, when re-testing onboarding, or use a separate private/incognito browser. Accept the privacy notice first.

## Student self-service clearance

- [ ] Brand-new browser: privacy notice appears first, then a five-step guide opens. It stays accessible with keyboard Back/Next/Skip and can be replayed via **How to check my clearance**.
- [ ] Returning browser: guide does **not** reopen automatically, and replay remains available.
- [ ] Register identity using test student ID and registered email; OTP errors do not enumerate registered identities. Never share OTPs in issue comments.
- [ ] Confirm authorized test student's own status only: `CLEARED`, `CLEARANCE ON HOLD`, or `NOT ENROLLED THIS TERM`. No other student, detailed balance or unauthorized roster data is exposed.
- [ ] Closing private session, switching browser tabs and expiry still hide private results. Historical obligations are not changed or silently dropped.
- [ ] A visitor without officer privileges cannot enter financial management screens.

## Officer / tenant admin / superadmin authorized views

- [ ] Roster total, enrolled count and not-enrolled count agree with previous valid records on default view. Changing status/year/term triggers accurate distinct counts and preserves security filters.
- [ ] Type in roster search: results refresh after ~400ms, first page resets; selecting year/status and navigating pages retains the correct search.
- [ ] Receipt History: search by student/name/OR and exact OR; records refresh after ~450ms. Date/category/status filters remain applied and results include all allocation lines of legacy base and `-P02` split ORs.
- [ ] Receipt History correctly flags suspicious sub-cent allocations as `Inconsistent` (only if an approved test fixture exists). Existing valid ORs are not reclassified without cause.
- [ ] Void Center: reactive search finds appropriate records but **does not perform a VOID**. Role restrictions and explicit financial confirmation remain.
- [ ] Officers see only their authorized tenant and tabs. Tenant admins see their tenant only. Superadmins view authorized tenant portals; confirm read-only policy on mobile and any currently required web privilege gates separately.
- [ ] Test signed certificate verification routes with approved synthetic data. Cross-tenant or anonymous results cannot display private balances.

## Financial snapshot invariants (read-only verification)

- [ ] Package fees and split allocations add up to original receipt amounts to the centavo; legacy single-row package summaries add up without phantom ±₱0.01.
- [ ] Existing valid historical partial + final payments remain distinct; previously verified ORs remain unchanged.
- [ ] Review penalties, fund balances, arrears, rollover and no-enrollment policy against earlier approved reconciliation snapshots. Do not auto-relink ambiguous historical rows.
- [ ] No new official receipt sequences are issued solely because a user searches, opens tutorials or refreshes summaries.
- [ ] Web and server-provided mobile financial read models continue to use the same calculation rules. Official Android v1.2.0 has not been updated by this web release.

## Loading/efficiency observations

- [ ] Compare initial vs repeat load for Dashboard, Students, Receipt History, Void Center and clearance on a representative connection (same tenant and similar period).
- [ ] Note any page over ~2 seconds, route/filter/role, approximate number of rows, browser/OS and time; **2 seconds is a proposed target, not a validated guarantee**.
- [ ] Check fast search typing, clear/cancel and navigation; stale search results, flicker, endless loading and out-of-order results require triage.
- [ ] No tenant identifiers, OTPs, student names, payment details or connection strings should appear in developer diagnostics or public bug reports.

## Feedback format

For each finding record: **module / role / browser or device / time (Manila) / steps to reproduce / expected / observed / severity / screenshot with personal data and OTPs redacted**. Consolidate findings before filing next patch. Tag financial correctness, privacy, unauthorized access or corrupted totals as **STOP** and do not submit live payments for testing.

## Rollout boundary

This bundle changes application source only. It does **not** perform a full `Float`→`Decimal` migration, mutate historical payments, fully optimize unrestricted Receipt History scans, certify p95 performance or publish a new Google Play build. See [#68](https://github.com/engrken/CLEAR/issues/68), [#69](https://github.com/engrken/CLEAR/issues/69), [#70](https://github.com/engrken/CLEAR/issues/70) and [#61](https://github.com/engrken/CLEAR/issues/61).
