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

## Production release gate
**Do NOT merge or deploy the feature while production lacks the two new
tables.** The app references the registry on login and privileged requests.
1. Review PR #20, green CI, staging tests and security design.
2. Verify the existing `SUPER_ADMIN_EMAIL` and SMTP settings are intact.
3. Choose a short maintenance window and create a **fresh** Neon snapshot of
   the current production `main` branch; preserve backup/recovery branches.
4. After explicit production approval, run
   `npx prisma migrate status` and review the five already-applied migrations
   plus this new migration. Historical manual `timestamptz` DDL was not
   recorded as a Prisma migration; do not `prisma db push` or reapply that SQL.
5. Apply **only the new account-tables migration** using the reviewed release
   plan and `npx prisma migrate deploy` on the verified production branch.
   This staging SQL rehearsal used manual DDL, not Prisma ledger tracking.
6. Verify the two tables exist, all tenant/payment/audit counts and amounts
   are unchanged, and the original SUPER_ADMIN_EMAIL is still configured.
7. Merge the reviewed application PR and wait for Vercel Production **Ready**.
8. Sign in as the **original** bootstrap Super Admin and open provisioning.
   Invite one controlled test Super Admin, complete their OTP, test both global
   entry points and verify Disable/Revoke immediately denies privileged routes.
9. Monitor audit logs, mail send limits, and role-isolation failures, then
   resume normal operations.

No production schema change, account creation, or deployment is authorized
by the creation of PR #20 alone.
