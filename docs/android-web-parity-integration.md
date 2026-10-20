# Android web parity integration — work plan

This branch is based on current `main`, not the older Android branch. No production changes are authorized.

## Source branches
- PR #18 / `mobile/apk-only`: original Expo Android app, mobile API, and mobile financial services.
- PR #40 / `security/android-integrity-audit`: proposed mobile payment request protection and parity review.

## Critical reconciliation
1. Preserve canonical web `lib/receipt-number.ts` and its server-owned `allocateOfficialReceiptNumber`. Do not accept an APK-supplied OR as authority.
2. Preserve the web `PaymentRequest` model and existing migration. Reconcile request-key namespace, payload hashing, and saved outcomes before adding any second idempotency table.
3. Reuse web financial services or extract shared transaction code. Do not transplant old mirrored payment logic without comparing the current collection, penalty, remittance, and period guards.
4. Ensure tenant-scoped authorization and active academic-period checks on every mobile route.
5. Verify package allocations (including FCUSR Activities Fund), penalty settlements, void/reversal semantics, and clearance rules against current web tests.

## Gate before merge
- Import reviewed Android app and mobile API changes from PR #18, then reconcile selected security changes from PR #40.
- Validate Prisma migrations on isolated nonproduction database.
- Run TypeScript, ESLint, unit/integration tests, duplicate submission/concurrency tests, Expo Android build and endpoint security tests.
- Require explicit approval before merge to `main`, production database migration, Vercel deployment or Play Console publication.

**Status: integration branch initialized; code port and validation NOT complete.**
