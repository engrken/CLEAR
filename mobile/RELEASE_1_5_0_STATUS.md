# Android 1.5.0 — verified work / pending release gates

Updated 2026-11-02. This document tracks **draft PR #132**, not deployed behavior.

## Confirmed implementation in branch
- [x] Officer and Global Administrator native account screens and opt-in biometric local unlock, subject to physical-device acceptance.
- [x] Canonical mobile finance read-only views for penalties, advances, liquidations and collection allocation lines.
- [x] Server-issued receipt numbers and shared transaction core for the draft Android payment handler.
- [x] Explicit tenant/role authorization, integer centavos, server Fee Setup/fund checks and UUID idempotency.
- [x] Manila accounting date derived from server; retries use the already-issued receipt's original date.
- [x] Package standard rate derived from all category package items, not one item.
- [x] Invalid/overpayment/retry-conflict API responses; Android cannot author an official receipt number.
- [x] Web, mobile, student-auth and established financial-security CI baseline passed as of CircleCI #332.
- [x] Real isolated CI test: default Android financial POST returns 403 for a valid officer without changing monetary records.

## Not verified / release blockers
- [ ] **P1** Verify the Android device provides cryptographically secure UUID generation; the current handler intentionally fails closed if its runtime cannot supply crypto.randomUUID().
- [ ] **P1** Real authenticated native payment POST end-to-end against disposable PostgreSQL under independently authorized UAT controls; verify concurrent identical requests, dropped response, changed retry, overpayment, package splits, receipts, and original balances. The draft positive test `tests/ci-mobile-payment-http.test.mjs` exists but is **not an accepted passing gate**.
- [ ] **P1** Release-safe tenant/action grants and Android UI activation. `PAYMENT_WRITES_ENABLED=false`, `MOBILE_BUSINESS_WRITES_ENABLED=false`, and the capability endpoint denies all; do not enable production.
- [ ] **P1** Secure mobile-to-web ticket issuance/redemption: full browser cookie, replay, revocation, maintenance and role isolation tests, then physical-device UAT. Keep handoff disabled.
- [ ] **P1** Financial change review for any shared web code: compare against deployed `main`, run authenticated regressions and ensure no change to live financial data.
- [x] Native payment vs. remittance write switches are independently disabled, so enabling cashier posting cannot accidentally unhide unsupported remittance verification/void controls.
- [ ] **P2** Native remittance verification/invalidation, student payment-proof submissions, penalties assessment/settlement, advances and liquidation approvals, voids, funds, tenant administration and other role-specific writes: **not approved or fully implemented**. Separate server-permission/transaction/audit gates required.
- [ ] **P2** All outstanding v1.4.0 carryover: maintenance/notice parity and student/officer regression UAT across web and Android; review #100, #97 and #81.
- [ ] **Release** Verify Expo native build, approved signing certificate, Play versionCode availability, secure HTTPS API, physical Android UAT and Google Play policy requirements.

## Production controls and quota
- Live web application and Production Neon financial records must remain untouched.
- PR #132 stays draft and unmerged; no Production feature flag change or Play submission.
- CI may use only throwaway local PostgreSQL fixtures. Do not misrepresent a disabled POST gate as successful transaction UAT.
- Prefer reusing the CircleCI financial-security job and existing cached workflows over repeated native builds.

## Evidence
- [PR #132](https://github.com/engrken/CLEAR/pull/132)
- [Baseline CircleCI #332](https://app.circleci.com/pipeline/56c4fdd2-598f-4fc4-9457-491d303c5c01)
- [Original positive-payment diagnostic CI #333](https://app.circleci.com/pipeline/2f68561a-4b26-477b-9f7a-7e4f6488a21a) (failed, **not accepted**)
