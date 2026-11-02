# CLEAR Android v1.5.0 — Web module parity: non-cash writes, cash-sensitive read-only

## Pre-build consolidation — 2026-11-02

- All 15 canonical web modules are included in the native role-scoped directory; native cash-sensitive operations remain read-only and financial posting redirects to secure web.
- Added authenticated native **current-period fund/fee setup review** with exact centavos, count bounds, and no financial writes. Authorized administrators may edit the calendar with an independent backend grant.
- Native report presentation now also edits institution school name/address beside signatories, preserving report logos and cash records, with SHA revision and serializable transaction.
- Added disposable-Postgres HTTP regression tests for the new report and setup routes, including negative cross-tenant and financial non-mutation assertions.
- The manually dispatched `android-v15-uat-signed-apk.yml` queues only a v1.5.0 internal signed APK after matching main/Production SHA, live API checks and explicit database mapping verification. It never uploads an AAB.
- No signed APK has been queued. CI on latest commit, Production rollout of new mobile APIs and Production database mapping remain required before build; physical device biometric and role-based UAT remain required afterwards.

---


## Native parity implementation increment — 2026-11-02

- **Clearance:** Added dedicated role-gated officer clearance review with current-period status and outstanding obligation details, using existing authoritative read-only clearance computation. No ability to override a financial clearance result.
- **Finance:** Added native read-only report *activity snapshot* (gross allocation-line totals, never certified receipt totals) and a paginated, tenant-scoped fund transfer history. All cash writes, reconciliation and official statements remain on secure web.
- **Reports:** Native report signatory presentation editor with optimistic versioning, serializable transaction, audit and separate `MOBILE_REPORT_SIGNATORY_WRITES_ENABLED` permission. Official report certification and submission still require the web workflow.
- **Global Administrator:** Native scheduling, cancellation and early termination of maintenance notices with audit/recovery safeguards and separate `MOBILE_GLOBAL_MAINTENANCE_WRITES_ENABLED` permission. Native global tenant lifecycle forms now consume a server-issued capability for `MOBILE_TENANT_OPERATIONS_ENABLED`, rather than relying on a client flag.
- **Security:** Added source contract checks for these modules; inherited tests for global tenant navigation were updated to assert *server-verified* permission grants, not the old static client lockout. All new server flags remain off on Production.
- **Release:** Signed v1.5.0 APK and physical biometric UAT have not begun; PR #132 remains DRAFT. CI for the newest revision must pass, including web lint, before signed UAT packaging. Deployment is separate from this draft review.

---

## Implementation checkpoint — 2026-11-02 (P1–P3)

**Branch:** `feature/android-v1.5.0-write-foundation-20261101` / draft PR #132. **Not merged or deployed.**

- **P1 implemented in source:** Tenant Administrator native officer create/edit, role and custom module permissions, with canonical server-issued role presets, exact tenant/administrator guard, own-account and protected Global Administrator exclusions, active-admin retention, optimistic update version, serializable transaction, uniqueness validation, audit and mobile-session revocation. Separate server opt-in `MOBILE_TENANT_USER_MANAGE_WRITES_ENABLED=true` *also requires* existing `MOBILE_TENANT_USER_WRITES_ENABLED=true`; both remain OFF on Production.
- **P2 implemented in source:** Native, tab-collectibles-permissioned, paginated current-period Collectibles summary using canonical web assessments and exact centavos. Student identity markers are removed from summary status. Assessment changes, payments and reconciliation remain web-only.
- **P3 verified at code SHA `6cbcda95ce5483f48e4825104ffd344ff21c86ed`:** all four CircleCI jobs (web/mobile/financial-security/student-auth) passed; GitHub Android v1.5 security contracts, Expo typecheck and lint passed. New synthetic authenticated HTTP tests verify officer create/edit cross-tenant exclusion, stale edit rejection, session revocation, auditable financial non-mutation and Collectibles pagination/privacy.
- **Remaining:** Clearance administration, full tenant settings/maintenance, non-cash report submission, comprehensive financial reports, fund realignment review, global-tenant native parity and other web-only modules. Full device biometrics/UAT, approved server rollout, APK and AAB remain pending.
- **Infrastructure:** Vercel Preview deployment is blocked by provider build-rate limits, not by a confirmed application regression. No Neon Production writes, finance-posting enablement or deployment performed.

**Release policy:** Financial/cash changes are web-only. Native operational writes are server-granted per action and tenant; web remains authoritative. No signed v1.5 APK is accepted yet. The AAB is prohibited until APK acceptance.

---


Updated 2026-11-02 — This policy supersedes earlier tracker text below. **Every one of the 15 canonical web modules must appear in the mobile module directory and follow the same live web role/tenant grants.** Do not claim all modules are natively complete merely because a module links to secure web.

## Latest clarified behavior
- **Cash-sensitive writes stay web-only:** payments, OR creation, reversals/voids, remittance verification/invalidation, advances disbursement, liquidation approvals and money-moving accounting operations. View and search them natively when authorized.
- **Non-cash writes are in scope for Android:** student roster create/edit/enrollment, self profile email changes, officer status/role management, academic and tenant settings, maintenance notices, noncash clearance administration and other web operational workflows. Each must reuse the web's canonical permission and audit rules, with independent backend authorization, no broad client-write flag.
- **Already native:** enrolled biometric device lock, officer and global account screens, dual-OTP self-profile email update, student roster edit foundation with independent grant, all-period Activity, four finance review modules, remittance review and Void audit.
- **Earlier increment:** native Officer Management list/search/keyset pagination and server-gated status changes with last-active-admin, protected-global-account, own-account, stale-edit, session revocation and audit checks. New independent server opt-in `MOBILE_TENANT_USER_WRITES_ENABLED=true` is required on verified main Production before status controls appear; `tab-users` alone cannot bypass it.
- **Still not full native parity:** tenant setup and maintenance writes, detailed officer clearance administration, report submission/editing, native global tenant provisioning/settings, comprehensive financial reporting and other web-only workflows. Officer creation/role editing and read-only Collectibles are now implemented on the draft branch but await server rollout and device UAT. Web routes remain available for these. Do not call these 100% complete or advertise release readiness.
- **APK before AAB:** v15-uat signed APK uses the Production HTTPS backend and authorized test accounts; after remediation and device acceptance, build a matching AAB. Do not alter real financial records for UAT.

## Current release gates
- [ ] New account-management server route and capabilities deployed to web main after the required security review; this code remains in a draft PR.
- [ ] Source, TypeScript, lint, authentication and CI integration tests green on final commit.
- [ ] Physical APK fingerprint/face/OS fallback, role isolation, roster/profile and officer account status UAT verified.
- [ ] Complete remaining native non-cash workflows and inspect all 15 web modules for parity.
- [ ] AAB versionCode and signing provenance approved following APK acceptance.

**Financial endpoints remain disabled in Android; no production deployment or Neon modification is authorized by source commits alone.**

---

# CLEAR Android v1.5.0 — Production-API APK verification then Play AAB (2026-11-02)

## Latest approved release sequence
1. **APK**: Use one `v15-uat` profile targeting the EXISTING Production HTTPS API, not a separate test UAT environment. Test the exact role-based financial read-only and roster/profile features expected on production.
2. **Fix and rebuild APK** if anything fails. Do not produce an AAB before successful signed-device APK acceptance.
3. **AAB**: Use `production` profile and the same API, roster-write, tenant-operation and financial-write policies as the tested APK. Verify Play signing and unique versionCode before submitting the bundle.

## Role/action policy
- **ALL financial transactions on Android are view-only**. Every write redirects to an authorized web module and requires web authentication and permissions.
- **Student roster** native create/update/current-term enrollment is the only tenant business editing in v1.5.0. Both the APK and AAB expose editing only for Students-granted officers who also receive exact server-side `students.*` grants.
- **User profile** native current-email/new-email OTP flow updates the officer's own login email, revokes prior sessions, and retains the official name/role as Administrator-managed web metadata.
- Native Global Administrator account viewing and opt-in device biometrics are present.
- **Biometrics:** SDK 58 `expo-secure-store` configured as native plugin; biometric-protected Keystore secret and identity preference; app lock on background; corrected OS prompt AppState transitions. Physical phone must confirm enrolled fingerprint/face, restart behavior, PIN/passcode fallback (only if OS offers it), and OTP fallback. No custom app PIN.

## Safety: current server rollout blocker
The Production web backend must first receive the verified mobile roster route and server capability grant, and only then enable `MOBILE_STUDENT_ROSTER_WRITES_ENABLED=true` on Production main for authorized accounts. The APK can ship to testers with the roster button configured but **it will NOT show write controls unless the server grants them**. Never enable financial write flags. Live roster tests must use explicitly designated test student records and user accounts; legitimate student/financial records must be preserved.

## Verification checklist
- [x] Native biometric implementation + app config present (source inspection).
- [x] Biometric prompt background-transition race addressed in source.
- [x] Single Production-API APK profile plus Play AAB counterpart in build config; both require a real server roster grant.
- [ ] CI source tests and Android lint/type checks all green on final SHA.
- [ ] Production web roster feature deployed and server opt-in reviewed BEFORE writable phone testing.
- [ ] APK actually built, installed and tested with enrolled fingerprint/face; Android lock-code fallback behavior confirmed on the device.
- [ ] Officer roster create/edit, own email update, permission changes, historical financial views and safe redirects accepted on APK.
- [ ] APK acceptance recorded; AAB generated afterward, verified and submitted for staged release.

No database migrations or Production state changes are authorized by these draft-branch edits alone.

## Previous tracker (historical draft)
# CLEAR Android v1.5.0 — APPROVED WEB-FIRST UAT SCOPE (2026-11-02)

**This approved scope supersedes earlier drafts proposing native financial posting or other native business writes.** Web remains the source of truth for all operational changes.

- Financial modules: **STRICTLY READ-ONLY on Android.** Penalties, collections, advances, liquidations, remittances, void audit, balances and Activity show authorized web data; any posting, approval, reversal, adjustment, transfer or financial configuration redirects to separately authenticated web pages. `PAYMENT_WRITES_ENABLED`, `REMITTANCE_WRITES_ENABLED` and `MOBILE_BUSINESS_WRITES_ENABLED` stay hardcoded false. Tenant provisioning also stays disabled in the UAT profile.
- Role parity: Android uses the current server-authorized `allowedTabs`, with a fresh role/tenant check on every API. The web app is ahead for all write workflows.
- Student roster: **native create/update/current-term enrollment** permitted only under both independent mobile-build opt-in and server-issued tenant-specific `students.*` grants. The web roster's canonical rules remain authoritative; no changes on Production or arbitrary previews without release approval.
- User profile: native viewing, dual-email-OTP login email update, and separate Global Administrator account view. Official name, role and permission changes remain Administrator-owned on web.
- Device security: opt-in fingerprint/face via Android Keystore / Expo SecureStore, OS-provided passcode fallback only when available, otherwise sign out and use server OTP. Never create an independent app PIN or claim local biometrics replace server authentication.
- Web redirect: first-party HTTPS module URLs, normal web RBAC/OTP; optional single-use auto-login handoff is separately feature-gated and **not required** to build or UAT this safer version.

## Source implementation and verification

- [x] Version `1.5.0` with Android `versionCode 16` staged in app config (the Play Console must still confirm uniqueness).
- [x] Web-first historical Activity, complete-on-demand page navigation for current term, Void audit, financial review module pagination on the draft PR.
- [x] Server-enforced exact-centavo financial reads and negative role/tenant tests; financial write switches remain false.
- [x] Native student roster add/edit foundation, server capability gate, closed-term and financial-history protection with isolated CI testing.
- [x] Dual-OTP profile editing and native biometric opt-in foundation.
- [x] Dedicated **v15-uat-readonly** EAS internal Android APK profile, pinned to Production HTTPS with all roster/business writes off.
- [ ] Required automated gates green **on current final commit**.
- [ ] Isolated roster-write test server and Android APK configuration approved for writable roster UAT; Production roster data must not be used for write testing without separate approval.
- [ ] Signed Android APK generated; physical-device tests verify biometric fingerprint/face, any OS passcode fallback, OTP and browser redirect.
- [ ] Real-user UAT for student OTP/clearance, roster, profile, all authorized modules, maintenance, performance, no financial write actions.
- [ ] Google Play Upload signer, unique versionCode and staged AAB release reviewed.

**UAT packaging is not production release.** The `v15-uat-readonly` APK profile can safely test live read-only flows and profile email changes; roster editing remains denied until an isolated, explicitly authorized backend is configured. Never infer a server write grant from a UI/build flag.

**Previous implementation audit follows (historical; financial posting tasks below are no longer in v1.5.0 scope):**

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

## Updated isolated CI acceptance
- [x] CircleCI #348 passed authenticated mobile payment posting, retry and package-allocation tests against disposable PostgreSQL. This does **not** authorize Production payment writes or replace device UAT.
- [x] CircleCI #349 passed the web, mobile, student-auth and financial-security suites after restricting Preview roster writes to the local disposable CI database.

## Current payment-retry safety work (2026-11-02)
- [x] Added exact-decimal peso-to-centavo parsing, with deterministic malformed-input and boundary tests.
- [x] A saved unknown-outcome cashier attempt now keeps its UUID and original student/fee/centavo draft across retries and restarts. A new/different draft is blocked until receipt confirmation; malformed secure-store recovery fails closed.
- [ ] A signed Android device must verify secure UUID availability and restart/OTP/network-disconnect retry UX. Manual reconciliation remains necessary when server rejects a previously uncertain attempt; never reset the key merely because of an HTTP error.
- [ ] These changes are source/CI acceptance only. Production payment switches remain false.

## Not verified / release blockers
- [ ] **P1** Native Student Roster POST acceptance: active role, disabled flags, email privacy for payment-only users, create/update/enrollment, student ID financial-history guard, concurrency and wrong-tenant denial on isolated PostgreSQL. The authenticated create/edit/privacy synthetic HTTP test passed in CircleCI #344; real-device UAT and activation remain pending.
- [ ] **P1** Verify the Android device provides cryptographically secure UUID generation; the current handler intentionally fails closed if its runtime cannot supply crypto.randomUUID().
- [ ] **P1** Real authenticated native payment POST end-to-end against disposable PostgreSQL under independently authorized UAT controls; verify concurrent identical requests, dropped response, changed retry, overpayment, package splits, receipts, and original balances. The synthetic HTTP test `tests/ci-mobile-payment-http.test.mjs` passed in CircleCI #348. Still verify on a signed Android device and perform bank/ledger reconciliation before Production activation.
- [ ] **P1** Release-safe tenant/action grants and Android UI activation. `PAYMENT_WRITES_ENABLED=false`, `MOBILE_BUSINESS_WRITES_ENABLED=false`, and the capability endpoint denies all; do not enable production.
- [ ] **P1** Secure mobile-to-web ticket issuance/redemption: full browser cookie, replay, revocation, maintenance and role isolation tests, then physical-device UAT. Keep handoff disabled.
- [ ] **P1** Financial change review for any shared web code: compare against deployed `main`, run authenticated regressions and ensure no change to live financial data.
- [x] **Roster term safety:** service rechecks active organization and accounting period inside its serializable transaction, with closed-term mutation denial tested on disposable PostgreSQL.
- [x] **Roster Preview safety:** unaudited Vercel Preview flags cannot enable writes; only an explicitly approved Production main rollout or the exact disposable local CI database can admit roster POST requests.
- [x] **Student Roster foundation:** native Add/Edit interface, active-term enrollment updates, student ID and email validation, identity-review attestation, stale-edit conflict protection, reactive server-side roster search, audit logs and tenant-scoped API with independent fail-closed roster-write switch. **Not yet activated; isolated authenticated UAT required.**
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

## Web-first parity additions — 2026-11-02
- [x] Native officer Activity can browse **all academic periods** only when the officer independently holds the web `tab-reports` grant as well as `tab-overview`. Existing web pagination service remains the source of truth; cursors and private rows are keyed by tenant, token and scope. No writes.
- [x] Native GET-only, paginated Void audit uses the canonical web VoidTransaction records, the existing `tab-void` grant, tenant-scoped keyset cursor validation and exact-centavo review. The Android Void module now offers browsing, but executing reversals remains web-only.
- [x] Android Global Administrator dashboard branding aligns with the approved display title.
- [ ] Run all source/CI checks on the final commit, then signed-device UAT. These reads do **not** replace pending native write workflows or approve release.
- Web production is the authority for all business changes and is not modified by these Android additions. Both features remain only on the draft v1.5.0 integration branch.

## P2 web-first finance review pagination — 2026-11-02
- [x] Android Penalties, Collections, Cash Advances and Liquidations review now page through the existing web financial tables using bounded, tenant/period/module-bound cursors; no financial posts or receipt aggregation.
- [x] The native workspace loads older pages on demand with session/module isolation. Search filters the loaded subset only; older server versions retain the secure web fallback.
- [x] Expanded the disposable PostgreSQL finance HTTP acceptance test to check allocation pagination, cursor isolation and unchanged financial records.
- [ ] CI and signed-device testing remain necessary before source changes are release-accepted.
