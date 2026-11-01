# CLEAR Android v1.4.0 — consolidated release gate

**Baseline:** Play Production v1.3.0, Expo `mobile/app.json` version 1.3.0, Android versionCode 15 (as of 2026-11-01). **Target:** one v1.4.0 release candidate; do not bump versionCode until signed build preparation and Play Console uniqueness are confirmed.

## P1 — must pass before release candidate
- [ ] Mobile maintenance/announcement screen consumes the same server-enforced global/tenant effective policy as web, including scheduled start/end, early completion, Manila time, foreground refresh and safe 503 handling. No client-only bypass.
- [ ] Student email/ID/OTP clearance renders CLEARED, HOLD **specific reasons** and NOT ENROLLED from canonical protected backend; reject wrong tenant, replayed/expired OTP and private cache leakage.
- [ ] Officer Activity, voided receipt history, ledger and exact-centavo allocations reflect canonical server data; bounded pages must never be labeled complete. Verify historical penalty 221.67 only against authorized original records, not by changing balances.
- [ ] Role-scoped student/officer/Administrator/Global Administrator navigation and API authorization. Never derive permissions solely from visible mobile cards.
- [ ] Release signing, package identity, unused Play versionCode, target SDK, production API base URL and Play Internal smoke checks.

## P2 — consolidate safe read-only functionality
- [ ] Native Penalties (current balance), Collections (receipt allocation lines), Cash Advances (approved amount) and Liquidations/Audit (verified expense) with independent per-module RBAC and GET-only API.
- [ ] Onboarding, reactive authorized-list search, accessibility, loading/error/empty states and student-friendly responsive navigation.
- [ ] Optional biometric local unlock after existing verified sign-in, secure token storage and fallback; no bypass of server OTP or account authorization.
- [ ] Tenant Administrator own-tenant overview and Global Administrator authorized tenant switching, without cross-tenant data persistence.

## Separate feature-gated later milestones (not part of automatic v1.4.0 write enablement)
- [ ] Native financial posting, remittance approvals, proof uploads, fund transfers, voids and tenant management writes: per-action audit, idempotency, Decimal centavos, closed-period and negative tenant/role tests; preserve `PAYMENT_WRITES_ENABLED=false` and `MOBILE_BUSINESS_WRITES_ENABLED=false` until independently authorized.
- [ ] Subscription status/entitlements, grace and invoices may display; **no Play-distributed InstaPay checkout, external billing CTA or proof-upload payment initiation** without verified Play policy permission.
- [ ] Native Android maintenance/finance and Play signing workflows should be reconciled with CircleCI migration #119, without unnecessary Gradle builds.

## One release train
1. Implement small, reviewable code PRs against main, prioritizing P1. Run existing CircleCI mobile + financial-security checks; avoid redundant expensive builds.
2. Verify negative auth, financial fingerprints and server maintenance enforcement using synthetic isolated DB only; no production financial test writes.
3. Assemble one v1.4.0 RC; check `versionCode > 15` and unused in Play Console, release keystore identity and build provenance.
4. Publish to Play Internal for UAT; collect redacted user feedback, fix blockers, then stage production rollout.
5. Do not close #81/#97/#100 until implemented parity is evidenced; avoid conflating planned features with current production defects.

Related: #81 #97 #100 #102 #119 #70 #114.
