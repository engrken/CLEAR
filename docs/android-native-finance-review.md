# CLEAR Android next release — native finance review (read-only)

This change is **source-only on a review branch**. It has **not** been merged, deployed to Vercel, included in a signed AAB, or delivered to Google Play. The owner separately confirmed that CLEAR Android **v1.2.4** already works in Production, including the corrected icon. Do not overwrite that published release.

## Modules and authorization

| Native module | Required active tenant-officer permission | Records available | Money meaning | Canonical secure web handoff |
| --- | --- | --- | --- | --- |
| Penalties | `tab-penalties` | Recent active-period assessments | Current remaining penalty balance, **not original assessment** | `/penalties` |
| Cash advances | `tab-advances` | Recent issued advances | **Original approved advance**, not current unliquidated balance | `/advances` |
| Liquidations | `tab-audit` | Recent audited liquidation register | Recorded expense amount, with original status | `/liquidations` |
| Collections | `tab-payment` | Recent **allocation lines** only | **One allocation's amount**, not a complete official receipt | `/collections/history` |

The new `GET /api/mobile/orgs/:org/finance-review?kind=<kind>&limit=<1..40>` endpoint:
- Rejects unknown categories and invalid limits (HTTP 400).
- Resolves a valid **active** tenant-officer session, checks its **current saved permissions** and exact organization slug *before* querying finance records. A global Superadmin token does **not** bypass the officer endpoint; students or anonymous callers are denied. Use existing `requireMobileOfficer` on every request.
- Binds every Prisma `findMany` to `organizationId`, `activeAy`, `activeTerm`. Returns only selected fields, sends integer centavos through the existing strict serializer, and does not expose raw SQL or receipt proofs.
- Restricts to 1–40 newest entries and returns `hasMore` if the page is incomplete. Does **not** offer full historical totals, misleading grouped-OR totals, unrestricted names, exports, or write methods.
- Inherits no-store headers and production read-only API method filtering from `handler`. No finance schema or Production database mutation.

Android's **Modules** directory opens a new native read-only Financial Records screen only for the assigned tab; independent React Navigation route guards hide unauthorized entry points, while the **server is authoritative**. Filtering is only over the visible, role-authorized bounded batch. For full finance/settlement/posting workflows, open a fixed allow-listed first-party HTTPS web URL that requires **separate web login** and canonical permission checks. Do not forward Android tokens or OTP via URL.

## Security and exact-centavo acceptance tests

Run from repo root:

```powershell
node --experimental-strip-types --test tests/android-finance-review-readonly.test.mjs
npm run test:mobile-roles
npm run test:finance
npx tsc --noEmit
cd mobile
npm ci
npm run typecheck
```

Before merging or making an Android release:
1. Use isolated test database/staging for **real integration** tests of each category. For every kind: valid grant, no grant, expired token, deactivated officer, cross-tenant token, global token in an org-only endpoint, anonymous token, invalid kind, limit 0, 41, nonnumeric/overflow. Verify all unauthorized requests return 400/401/403 as appropriate and **zero finance writes** in audit events.
2. Compare returned penalty remaining balances against the canonical web Penalty module including partial settlement / void / cancel status. Never label `fineAmount` as initial amount.
3. Compare cash advances and corresponding liquidations against canonical web records, status/period boundaries, reversals, and closed accounting periods; approved amount is not the unliquidated balance.
4. Compare package receipts containing multiple `-P02` allocations; native card amount must represent **only the line**, not an OR group. Full Receipt History via secure web remains the source of truth. Confirm exact centavos including unusual legacy data and proper fail-closed behavior for malformed values.
5. Ensure native tab changes do not leak records from previous views while fetching, and that web login is independent (no app bearer/OTP in URL).
6. Complete source CI and separate preview DB QA; then build **one** signed next Android Play AAB with a fresh unused versionCode and the same approved upload certificate. Use Internal track real-device UAT and owner approval before Production.
7. Track complete historical pagination and measured p95 performance in #70. This endpoint intentionally provides only a recent bounded page and must never be marketed as full financial records.

## Explicitly excluded (roadmap #81)

- Penalty issuance, settlement, service conversion, or reversal
- Payment posting, official receipt sequencing, or voiding
- Cash-advance issuance, approval, fund expenditure, or cancellation
- Liquidation submission, approval, evidence upload, editing, or audit reversal
- Remittance approval, funds transfers, balance adjustments, and any other native financial writes

These functions require new independently authorized, auditable canonical server actions and negative tests in isolated finance staging, rollback and owner approvals. **Do not enable broad `PAYMENT_WRITES_ENABLED` / `MOBILE_BUSINESS_WRITES_ENABLED` switches.**
