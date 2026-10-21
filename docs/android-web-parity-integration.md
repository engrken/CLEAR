# CLEAR Android integration — guarded workstream (PR #41)

**Draft integration branch only. Do not merge to `main`, deploy to Production,
apply migrations to Neon Production, or publish to Google Play without a
separate signed-off financial and mobile release review.**

## Source branches and ancestry

- PR #18 (`mobile/apk-only`): original Expo app and mobile API implementation.
- PR #40 (`security/android-integrity-audit`, targeted at #18): security and
  mobile idempotency proposal; review selectively, not as a wholesale database
  migration.
- PR #41 (`android-parity-integration`): staging of reviewed Android UI,
  authenticated read-only mobile API, and release/build infrastructure.
- `main`: authoritative deployed web financial business rules. Before
  proposing a merge, resolve drift since PR #41 branched, including PRs
  #39, #42, #43 and #44 and any later changes.

## Verified implementation state

- Mobile officer OTP and bearer-session paths have been ported; test
  permissions, tenancy, revocation and active academic-period scoping against
  live current-main code *in an isolated environment*.
- Mobile read endpoints for organizational details, dashboard, students,
  clearance and fees are staged. They must be checked against the current web
  behavior before release.
- The mobile client deliberately sets `PAYMENT_WRITES_ENABLED = false`.
  **No mobile payment/verification/invalidation posting routes are present** in
  this staging branch. Public mobile proof submission returns HTTP 503.
  These are deliberate restrictions, not completed features.
- An unsigned Gradle workflow is present; a successful runner and build must be
  observed before declaring the APK buildable. Binary assets and
  reproducible `mobile/package-lock.json` remain release-review items.
- Finance regression `tests/financial-integrity-android-readonly.test.mjs`
  enforces the interim no-write boundary. Do not edit/remove this test without
  first implementing and independently verifying the canonical write service.

## Required reconciliation before enabling payment or remittance writes

1. Rebase/merge current `main` into the integration branch with explicit
   review of conflicts. Do not overwrite newer financial safeguards.
2. Keep receipt numbers **server-allocated only** through
   `allocateOfficialReceiptNumber`; reject any APK-supplied authoritative OR.
3. Reuse the web `PaymentRequest` model and its payload hash/request ID
   semantics. Do not create a competing idempotency ledger or a second
   independently allocating OR sequence.
4. Execute financial writes using the existing
   `withFinancialTransaction`/Serializable policy, period locks,
   organization access, configured fee/fund rules and receipt outbox.
5. Preserve package allocations (including the ₱650 JIECEP package / ₱100
   FCUSR Activities Fund), historic penalty cash and service settlements,
   reversal/void semantics, student clearance, and closed-period rules.
6. Verify proof upload limits and officer verification paths reuse web
   validation and durable throttle, without trusting client IP headers.
7. Before testing **any** financial posting, require isolated PostgreSQL
   fixtures, duplicate-tap and dropped-response retries, concurrent requests,
   tenant escape attempts, closed-term attempts, and exact receipt/ledger
   invariants. Never test transaction posting against real Production.
8. Build the unsigned APK, test on an Android device/emulator, confirm HTTPS
   production API base URL and the runtime privacy/account-deletion flow,
   and complete Google Play policy checks separately from web deployment.

## Release gates

- GitHub web financial checks, TypeScript, lint, Prisma migration rehearsal,
  Android SDK build and mobile backend integration tests must pass.
- Manual permission and cash accounting review, including new or revised
  API routes, is required.
- Obtain explicit authorization for each of: merging the integration PR,
  running any new migrations in Production, deploying mobile API routes,
  and Play Console submission.
- Vercel Preview may be skipped per owner instruction if its build-rate
  limit blocks it, but **successful Production deployment and smoke testing
  remain mandatory** before reporting the new API as live.

This checklist is a living integration tracker, not a claim that Android is
ready for Production.
