# CLEAR — Multiple Global Super Admin Accounts

**Feature branch only / PR #20; not deployed to production.**

## Existing owner is preserved
The original `SUPER_ADMIN_EMAIL` environment variable remains the unique **bootstrap
Super Admin**. The account does not need to be migrated to `TenantUser` or
`GlobalSuperAdmin`; its existing authorized email and 5-minute OTP workflow
continue to work. Never delete/change this environment variable during rollout.

## New model
- `GlobalSuperAdmin` holds additional **global** admins, independent of any
  tenant's `TenantUser`, with name, normalized unique email, invitation expiry,
  Active/Pending/Disabled/Revoked status, and `sessionVersion`.
- `GlobalAdminAudit` records privileged invitation, renewal, activation,
  sign-in, disable, re-enable and revocation events with acting/target emails.
- Only authorized active global administrators can manage global accounts, through
  `/dashboard/provisions` (SaaS Institutional Provisioning) after OTP login.
- Invitations expire after **7 days** and may be renewed. A notice email is
  sent, but it contains **no OTP** or authentication link. An invited admin
  accesses the official dashboard and requests their own OTP.
- OTPs are HMAC-hashed, six digits, **5-minute expiry**, one-time use.
  Existing per-email 60-second resend cooldown, five sends/hour and five
  guesses followed by a 30-minute lockout apply independently.
- The first successfully verified OTP changes Pending to Active atomically and
  records the verified email identity. All accounts have independent email
  addresses, human names and audit records.
- NextAuth JWTs and the separately signed Entity Admin Portal session carry an
  account ID and version. **Each protected request reads current database status
  and matches the session version**, so disable/revoke blocks a previously
  issued session from privileged routes. The bootstrap owner is validated
  against the currently configured `SUPER_ADMIN_EMAIL`.
- Accounts already used as tenant users cannot be invited as global users.
  Global-admin emails are reserved from the tenant user provisioning and status
  management routes. Revoked global emails remain reserved to avoid accidental
  role reuse.

## Administrator instructions
1. Sign in via **System SuperAdmin Access** using the original bootstrap email
   and your personal OTP.
2. Open **Dashboard → SaaS Institutional Provisioning**.
3. Under **Global Super Admin Accounts**, enter a distinct full name and email
   and press **Invite Super Admin**. Do not share OTPs or sessions.
4. The invited person receives a notice (if SMTP is available), opens the
   official CLEAR dashboard, requests an OTP to that email, and verifies it.
   Their account becomes Active only on successful email verification.
5. Use Disable to temporarily stop access, Enable to reactivate it, or expand
   Revoke to permanently remove platform privileges. A revoked email cannot be
   re-invited automatically; consult the operator for restoration.
6. Review **Recent Super Admin Security Audit** to see who invited or altered an
   account. The bootstrap account cannot be disabled using this UI.

## Verified on isolated staging
- Neon project `clear-sys-db`, staging branch
  `clear-multi-global-super-admin-staging` (`br-floral-sunset-b3kbg94c`);
  production `main` remains separate and unchanged.
- The SQL in
  `prisma/migrations/20261019115000_global_super_admin_accounts/migration.sql`
  created **only two new tables and four indexes** on staging. Schema diff
  agrees with the intended additions.
- An isolated SQL transaction tested Pending → Active → Disabled → Revoked,
  checking sessionVersion increased from 1 → 2 → 3 and invitation validity;
  every test record was rolled back. Both tables were empty afterward.
- GitHub Actions CI passed after the initial backend, management and tenant
  access-control changes, and was rerun after invitation/confirmation refinements.
- Application-level live SMTP/OTP and login tests are **pending** until a
  controlled staging/production release.

## Production schema migration completed — October 19, 2026

The operator separately approved using a verified Neon recovery branch in lieu of
a fresh snapshot, because the Neon project returned `snapshots limit exceeded`
while creating a fresh snapshot. **Do not delete the older snapshot**.

- Production branch: `main` (`br-calm-dew-b3vd1ira`), project
  `wandering-wind-73071792`.
- Verified **precutover recovery branch**:
  `clear-global-superadmin-20261019-precutover-recovery`
  (`br-delicate-rice-b3c67yej`). Immediately before the change, production
  and recovery matched on 3 organizations, 492 collections, ₱124,152.00
  collected, 12 TenantUser rows, 288 tenant audit logs, 7 mobile sessions,
  and five applied Prisma migrations.
- A mobile session's `lastUsedAt` advanced after the branch was made, so
  that one non-financial value is not necessarily identical to the recovery
  snapshot. Old financial data and row counts remained equal.
- The six SQL DDL commands from
  `prisma/migrations/20261019115000_global_super_admin_accounts/migration.sql`
  were applied to **production only** as a single guarded Neon database
  transaction (not via Prisma CLI). In the same transaction the exact source
  SHA256 checksum was inserted into `_prisma_migrations`, with the expected
  Prisma migration name, status, and `applied_steps_count=1`.
  This is intentional manual migration-history synchronization, not a claim
  that `npx prisma migrate deploy` was executed.
- Recorded Prisma filename:
  `20261019115000_global_super_admin_accounts`.
  Checksum: `c8fce5c89b821c8305206856760788f4ea5d941e79203f1f95fa399be6099223`.
- After execution: **two tables, six indexes** (two primary keys, four
  additional indexes), **zero additional admin accounts**, **zero global
  audit events**. There are now six successful migration-ledger entries,
  with all five pre-existing migration checksums unchanged.
- Business baseline remained 3 organizations, 492 collections,
  ₱124,152.00 total collections, 12 TenantUser accounts, 288 SystemLogs
  and seven MobileSessions.
- **Do not rerun the SQL or call `prisma migrate resolve --applied`**
  for this specific migration: it already has an applied history record.

The application rollout remains a separate, uncompleted step: PR #20 is still
**Draft and unmerged**, and Vercel Production has not yet deployed the new
account-management version. The current production app can continue using
the original `SUPER_ADMIN_EMAIL` because the migration was additive.

### Application rollout — still pending

1. Confirm the Production Vercel `SUPER_ADMIN_EMAIL` configuration is intact,
   the SMTP email service is working, and new code passed GitHub CI.
2. Review PR #20, mark Ready for Review, then merge to `main` when explicitly
   approved. Wait for Vercel **Production Ready**, and verify it deployed the
   merged commit.
3. Sign in using the **existing** original Super Admin OTP. Visit
   `/dashboard/provisions` and verify that **Global Super Admin Accounts**
   is available.
4. Invite one distinct test administrator, confirm invitation notice,
   complete first personal email OTP, and test both NextAuth dashboard and
   separate Entity Admin Portal sessions.
5. Test Disable, Enable, and Revoke. Verify privileges disappear on an existing
   logged-in session without waiting for JWT expiry. Review GlobalAdminAudit.
6. Verify public clearance, protected tenant workflows, and audit attribution
   remain correct; retain the recovery branch.

The historical manual 33-column PHT timestamp cutover is **not** a migration
tracked by Prisma. Do not `prisma db push` or rerun that conversion.
