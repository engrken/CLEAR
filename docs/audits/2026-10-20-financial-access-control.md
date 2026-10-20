# Financial access-control audit — 2026-10-20

## Scope
Reviewed `app/department/[department]/actions.ts`, `lib/permissions.ts`, `lib/super-admin.ts`, payment posting, and fund-transfer authorization.

## Fixed: financial actions privileged-session bypass
Previously, `requireOrganizationAccess` accepted an email matching `SUPER_ADMIN_EMAIL` or a session role string of `SuperAdmin`/`master` without invoking the central global-admin session verifier. The fix uses `verifyGlobalAdminSession` with the identity and revocation version; rejects reserved admin addresses when their privileged session fails validation; and requires a normal officer session's organization ID to match the financial data's organization ID before checking active tenant membership.

## Final shared-guard follow-up
Review identified a second tenant-isolation weakness: `lib/permissions.ts` previously resolved active user membership using email in the requested tenant without confirming that the original OTP session was issued for that tenant. This allowed a session for tenant A to be evaluated as a tenant B member when the same email was registered in both organizations.

PR #36 now enforces `assertTenantSessionScope` in both the shared permission checker and the financial-actions helper. Verified global-admin sessions bypass the tenant-only comparison. Four focused tests in `tests/tenant-session-scope.test.mjs` cover matching tenants, cross-tenant reuse, missing/malformed IDs, and mismatched IDs. These focused tests passed in a Node 22 environment on October 20, 2026. Full application rebuild and integration smoke checks against these final changes are still required.

## Accounting changes
No ledger math, receipts, official receipt numbering, migration, or stored financial records were modified.

## Required release checks (not yet executed)
1. `npm ci`, `npx prisma generate`, `npm run build`, and the repository's test suite.
2. In a QA department: verify officers can view only their own department's financials; another department's records must reject authorization.
3. Verify a valid global super-admin can inspect financial data, and revoked/invalid sessions are rejected.
4. Confirm public clearance retains only the intended public data, without exposing officer financial metrics.
5. Verify receipts, fund movements, audit trails, and totals before and after deployment; do not manipulate production test records.
6. Check deployment logs and a backup/recovery test before promoting the change.

## Remaining review items
- Independently review privileged bootstrap admin session policy, including revocation strategy.
- Confirm all financial server actions use the centralized tab and organization guard.
- Run concurrency tests for duplicate OR submissions and same-student simultaneous payments.
- Reconcile balances against independent opening balance + receipts - disbursements calculations.

This file documents source-level findings only; it does not certify a completed security or financial audit.
