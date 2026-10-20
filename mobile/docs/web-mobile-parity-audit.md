# CLEAR web-to-Android functional parity audit

Status: INITIAL SOURCE INVENTORY ONLY — NOT verified functional parity.
Branch: security/android-integrity-audit. No production deployment authorized.

## Architecture requirement
- The web application and native Android app must access the same tenant-scoped server-side financial services and PostgreSQL source of truth.
- A matching UI is not proof of matching accounting rules. Every Android write must use server-side authorization, active academic period validation, balance verification, atomic ledger updates, audit logs, and receipt outbox behavior.
- Do not duplicate financial calculations in the APK or grant it direct PostgreSQL credentials.

## Confirmed Android API surface (mobile/src/api/types.ts and http.ts)
- Public: organizations, department profile, clearance lookup, fee listing, remittance proof submission.
- Officer authentication: request/verify OTP, session restoration, sign-out.
- Officer: dashboard summary, ledger listing, students listing, payment recording, remittance details, remittance verification, remittance invalidation.

## Web modules requiring separate parity verification
These modules exist in the web system but have NOT been shown equivalent in the Android API inventory:
- Collection setup, packages and fund allocation administration
- Penalties (create, settle, void and log visibility)
- Cash advances and liquidation/audit
- Collectibles and assessments
- Fund transfers, realignment and balances
- Financial reports and exports
- Receipt void/reversal workflow and OR sequence
- Student management and enrollment changes
- Officer accounts, permissions, setup and super-admin provisioning
- Academic period rollover, closing and historical access
- Clearance officer review, QR issuance and verification

The absence of a method from the current Android API interface is not by itself proof that a screen is missing, but it is a concrete API parity gap to investigate.

## Mandatory feature-by-feature acceptance matrix
For EACH web workflow record:
1. Web page/server action and authoritative shared business service.
2. Android screen, mobile endpoint, request/response types.
3. Role, department, and academic-period permissions.
4. Financial effects, OR generation, fund balances, and audit records.
5. Idempotency, retry, reversal, and offline behavior.
6. Matching test vectors and expected database effects.
7. Result: PASS / FAIL / NOT IMPLEMENTED / NOT TESTED.

## Release blockers
- Complete source-by-source parity review of the web and mobile routes.
- Implement or explicitly scope missing workflows before calling APK feature-complete.
- Verify payment replay and package/penalty splits with isolated PostgreSQL integration tests.
- Generate and commit a reproducible Expo dependency lockfile; validate Expo Crypto compatibility.
- Run backend and Android typechecks, lint, build, and security tests.
- Keep production Vercel/Neon and Play Console unchanged pending review and approval.

## 2026-10-21 main-branch reconciliation finding (BLOCKER)
GitHub comparison found main is 115 commits ahead of the Android base branch, with divergent histories. The current web main introduces:
- `lib/receipt-number.ts` with transaction-scoped receipt advisory locks and server-owned OR allocation.
- `PaymentRequest` idempotency model and migration `20261020010000_payment_request_idempotency`.
- Changes to collections, remittances, clearance, penalty workflows, receipt grouping, and financial tests.

The mobile branch currently implements a separate `MobilePaymentIdempotency` model and still takes an officer-entered OR. These designs are **not proven equivalent**. Do not merge both migrations into production or claim parity until a current-main-based integration branch reuses the canonical web OR/idempotency policy and passes tests. PR #40 is only a draft staging PR against the older mobile branch, not a main-ready merge.
