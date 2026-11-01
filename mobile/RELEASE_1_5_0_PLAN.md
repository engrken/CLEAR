# CLEAR Android v1.5.0 — operational parity release plan

**Status:** Planned, not implemented. v1.4.0 production is not assumed released. This plan does not enable financial or tenant writes.

## Goal
Enable authorized Officers, tenant Administrators, and Global Administrators to perform appropriate mobile transactions matching the canonical web authorization model. Preserve student privacy, tenant boundaries, and financial exact-centavo integrity. Include all incomplete v1.4.0 commitments.

## P0 release blockers — security and financial writes
- [ ] Inventory every web write endpoint and mobile action; define server-enforced per-role/per-tenant/per-module action permissions, including explicit deny tests and Global Administrator scope.
- [ ] Design mobile write endpoints or safely reuse existing web business services; enforce authenticated identity, CSRF/session/token protection as applicable, server-side validation, idempotency keys, optimistic concurrency, and audit trails.
- [ ] Collections/payments: exact integer centavos, allocation validation, unique receipts, atomic posting, reversal/void policy, reconciliation and ledger invariants.
- [ ] Penalties: authorized assessment/adjustment/settlement, immutable history and reconciliation.
- [ ] Cash advances and liquidations: submission, review/approval segregation, supporting evidence access, posting and closed-period rules.
- [ ] Remittances and voids: role-restricted approvals, mandatory reasons, append-only audit, and dual-control where required.
- [ ] Clearance decisions and hold reasons: officers may modify only within their assigned organization/permissions; students retain private read-only inquiry.
- [ ] Tenant administrators: authorized own-tenant user/role/configuration writes; Global Administrators: separately audited cross-tenant operations. Never infer global rights from department roles.
- [ ] Enable `PAYMENT_WRITES_ENABLED` and `MOBILE_BUSINESS_WRITES_ENABLED` only per verified capability behind server-controlled rollout flags; do not globally enable before complete negative auth and finance regression gates.

## v1.4.0 carryover — complete and verify
- [ ] Optional biometric local unlock for returning authenticated users; secure-store binding, OS biometric prompt, explicit opt-in, disable/revoke, session expiry, OTP fallback, device-change and sign-out behavior.
- [ ] Global and tenant maintenance notices, scheduled start/end, early completion, Manila timezone and fail-safe handling.
- [ ] Student clearance OTP privacy, detailed hold reasons and cross-tenant denial.
- [ ] Accurate complete/paginated Activity, voided receipts, collections/penalties/advances/liquidations read views, including historic centavo reconciliation.
- [ ] Role-aware navigation for Officers, Administrators and Global Administrators; tenant switching without stale data leaks.
- [ ] First-use onboarding, reactive search, accessibility, loading/error/empty states and consistent terminology.

## Release acceptance gates
- [ ] Isolated synthetic database integration tests for each write route, forbidden roles, tenant crossover, replay, duplicates, concurrency, rollback, negative balances, closed periods and audit completeness.
- [ ] Validate existing production ledger fingerprints unchanged; never test financial writes against live production.
- [ ] CircleCI security/finance/mobile suites pass; avoid redundant costly GitHub runners and Vercel deployments.
- [ ] Signed APK internal UAT for every role; signed AAB with Play-unique versionCode, matching upload certificate, production API and policy compliance.
- [ ] Play internal testing, documented UAT sign-off and staged production rollout with server-side kill switches and rollback plan.

## Out of scope until separately policy-approved
- Google Play-distributed external QR/InstaPay subscription checkout or payment redirection without verified Play policy compliance.
- Enabling unverified financial or tenant-management writes globally.

Related: mobile/RELEASE_1_4_0_PLAN.md and PR #130.

## Repository audit — 2026-11-01
- The existing `app/api/mobile/orgs/[org]` routes expose read-focused resources and authentication, onboarding, profile email, presence and proof submission. **No mobile `payments/route.ts` exists**; the Android `recordPayment` client method points to a missing route and is deliberately disabled. Do not enable the payment flag before implementing the canonical server handler.
- The mobile client similarly contains guarded remittance verification/invalidation calls; verify server endpoints and web service parity before enabling either.
- Draft PR #132 currently adds client-side action-grant types and deny-by-default tests only. It is **not server authorization** and must never be considered a security boundary.
- Production write enablement requires separate implementation PRs, passing integration tests against isolated data, audit review and signed mobile UAT. A successful database check alone does not authorize production rollout.
