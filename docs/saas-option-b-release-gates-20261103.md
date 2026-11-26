# Web SaaS Option B — guarded implementation status (2026-11-03)

This branch contains **pure subscription policy and tests only**, not an activated
billing or registration service. It is intentionally not deployed.

- Freemium/Pro/Corporate entitlements are independently granted by the existing
  tenant provisioning authority, not a payment screenshot.
- Paid plans use **7 full Asia/Manila calendar days** of grace after due date;
  only a separate audited service may enforce the subsequent read-only lock,
  preserving student clearance history and existing records.
- InstaPay QR is **web-only** in the planned billing portal; Google Play
  Android must not display alternative external subscription payment checkout
  unless the applicable Play policy permits it.
- Manual Option B bank-credit verification is an action of an independently
  authenticated Global Administrator, not automatic QR or proof verification.
  Future DB persistence must use transaction isolation + unique (receivingAccountId, bankReference) approval keys across all invoices and tenants
  and issue subscriptions only after bank credit is confirmed.
- No subscription database migration, tenant lock, merchant QR, bank account,
  payment receipt or license activation is created by this branch.

**Remaining blocking prerequisites before Production:**
1. Authorized business/merchant receiving-account evidence and validated
   InstaPay receiving QR; no personal transfer misclassified as merchant billing.
2. Reviewable Prisma invoice/verification/subscription schema + audited migration,
   isolated database tests, and idempotent activation/renewal transactions.
3. Secure administrator registration with email OTP, pending review queue,
   explicit approval and existing provisioning-core integration.
4. Web invoices, proof submission, restricted verification UI, notifications
   and billing grace alerts.
5. Role, tenant, double-approval, concurrency and bank-duplicate negatives;
   monitored UAT. No automatic production activation.
