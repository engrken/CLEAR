# CLEAR System

**Centralized Liquidation of Expenses & Audit Records**

CLEAR is a **multi-tenant, web-based financial administration and student clearance system** for schools, academic departments, and student organizations. It combines student enrollment records, collection fees, official receipts, remittance review, funds management, penalties, receivables, cash advances, liquidation, audit reports, and student clearance in a tenant-scoped workspace.

> **Project status (October 2026): Pilot / User Acceptance Testing (UAT).** Core features and multiple security improvements have been implemented, and successful local production builds have been reported. This is **not a certification of production readiness, penetration-test results, or 50-user capacity**. Verify the final consolidated build and end-to-end financial workflows against an isolated staging database before accepting real payments.

## Contents

- [Capabilities](#capabilities)
- [Financial rules](#financial-rules)
- [Technology](#technology)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Database schema and migration safety](#database-schema-and-migration-safety)
- [Application routes and project structure](#application-routes-and-project-structure)
- [Verification and UAT](#verification-and-uat)
- [Deploying to Vercel](#deploying-to-vercel)
- [Security and operational notes](#security-and-operational-notes)
- [Known limitations and roadmap](#known-limitations-and-roadmap)

## Capabilities

### Multi-tenant onboarding and access control

- Organization/department workspaces at `/department/[department]`, with department-specific financial records and branding.
- Super Admin provisioning under `/dashboard/provisions`, including a tenant's initial academic year, school calendar, and administrator.
- Guided first-time setup for **fund pools** and **collection fees**.
- OTP-based authentication with Auth.js/NextAuth; role-based and tab-based permissions enforced by server actions.
- Tenant-scoped permissions for financial posting, reports, reversal, setup, and user management. A user cannot use User Management to deactivate or delete their **own current account**.
- Student-facing clearance access distinct from authenticated officer details. Public responses should not expose the student's specific unpaid items.

### Flexible academic calendars and controlled term transitions

Each tenant can configure its calendar **per academic year**:

| Calendar | Accounting periods |
| --- | --- |
| Full School Year | `Full Year` |
| Semester | `1st Sem`, `2nd Sem`, optionally `Summer` |
| Trimester | `1st Trimester`, `2nd Trimester`, `3rd Trimester` |

- Calendars are set during tenant provisioning and can be configured for future academic years.
- Financially active historical periods cannot be renamed or silently reclassified.
- The **Close → Carry Over → Open** workflow records the source-period closure, carries verified *available* funds into the next period's **General Fund**, and activates the destination academic year and term. A legitimate zero-balance close does not fabricate a transfer.
- A rollover may retain eligible fee settings or leave the destination period for manual Fee Setup; applicable accounting and authorization guards still apply.
- Ordinary financial posting to formally closed periods is blocked.
- Unpaid **recorded** penalties and assessed collectibles remain tied to their originating period and can hold clearance in later terms or years. Paying an earlier debt posts a **new OR in the active period** and links it to the original obligation.
- Historical mandatory-package fees that were *not assessed to an individual student* are **not automatically presumed to be debt**.

### Fee Setup, fund pools, and financial ledger

- Configurable fee categories, names, amounts, mandatory package membership, and destination funds by tenant/year/term.
- Mandatory collection packages can split a receipt across configured fund allocations; standalone fees can be assessed as individual collectibles.
- Fund Setup supports adding new pools during an active period, typically with a **₱0 opening allocation**. Funds already referenced by financial activity are protected against renaming, removal, or opening-allocation edits.
- A tenant-specific **Penalty Fund** is used for new linked cash penalty payments. Earlier receipts retain their original historical fund assignment.
- Shared period ledger combines opening allocations, valid collections, active advances, audited expenses, and inter-fund transfers. Cashier deposits/withdrawals change **cash custody**, not recognized income.
- Fund transfers and period rollover are recorded, rather than replacing historical transaction rows.

### Collections, receipts, and remittances

- Tenant- and period-specific payment processing with official receipt (**OR**) numbers; supports standalone fees, fee packages, penalties, and current-period payments toward previous-period arrears.
- **Receipt History** at `/department/[department]/collections/history`: search, pagination, receipt details, and **reprint** using the original OR/date. Voided ORs remain visible only as clearly marked **VOIDED audit copies**.
- Authorized email **resend** for valid existing receipts; resend does not create a new OR or book additional income.
- Student online-remittance proof submission followed by officer approval or rejection. An approved remittance is linked to its issued receipt; a rejection notice is **not** a payment receipt.
- University Cashier deposits and withdrawals maintain custody history separately from fund-income balances.
- Approved remittance reversals and receipt voids are permission-controlled and should reconcile the remittance status, linked obligations, and ledger impact together.

### Students, penalties, and collectibles

- Student roster, enrollment statuses, CSV imports, and **selective year-level promotion** (individual checkboxes rather than mandatory promotion of everyone).
- Students with linked financial activity should be **inactivated/archived**, not physically deleted; accidental deletion is blocked with an explanatory message.
- Two penalty categories: **community-service-eligible assessments** and cash-only **Late Fees**. Partial cash payments reduce the outstanding balance; late fees cannot be converted to community service.
- Penalty settlement history records payment/service method, amount, dates, processing information, and OR references where applicable; receipt reversals preserve history.
- Collectibles derive item/category/amount/fund from the configured Fee Setup and provide payment history, search, status filtering, pagination, and authorized assessment voiding.
- Where a collectible has received payments, those receipts must be safely reversed before the assessment itself can be voided. Voiding a linked receipt restores the appropriate obligation without erasing the OR history.
- Cross-period outstanding **assessed** penalties and collectibles continue to influence the student's clearance status.

### Advances, liquidation, reporting, and reversals

- Cash advance issuance, source-fund reservation, and history with authorized cancellation.
- Itemized expense/liquidation records, evidence attachments, and audited-liquidation reversal with safeguards for linked advances.
- Searchable **Void Center** with pagination, required reasons, permissions, fund-solvency checks, and audit logs. Reversals preserve historical records rather than simply deleting them.
- **Detailed Reports** provide item-level transactions and pagination; **Summary Reports** aggregate counts and amounts by category, rather than listing student names, penalty IDs, or raw transaction descriptions.
- Theme-adaptive confirmations, warnings, input prompts, and notifications consistent with CLEAR's light/dark mode.

### Email receipts and preferences

- Posted cash collections/penalty payments and approved remittances can queue **digital official receipts** for the registered student and processing officer, each with the recorded OR and financial details.
- Non-OR financial events (cashier custody, advances, liquidation) use **acknowledgment/summary notices**, not invented OR numbers. Rejected remittances use rejection notices.
- Email delivery uses a transaction-linked **outbox** (`DigitalReceiptDelivery`) with post-commit dispatch and retries. An SMTP failure does **not** undo a successful financial transaction.
- Students and officers may opt out of routine transaction messages; officer processing-copy preferences are separate. Opt-outs are checked both when an email is queued and before delivery. **OTP/security messages are not suppressed** by these routine-notice settings.
- Manage preferences through the officer profile/`/department/[department]/email-preferences`, or through the protected recipient link provided in email.
- Voiding a transaction does **not** generate a new financial receipt email. A pending, unsent receipt for an already-voided OR must not be dispatched.

### Encrypted backups and audit records

- Manual backup export and authorized restore use an **AES-256-GCM authenticated encrypted backup** (`*.encrypted.json`) rather than editable plaintext JSON.
- A modified encrypted backup, wrong key, wrong tenant, or legacy plaintext import is rejected by the standard restore route.
- Tenant-scoped restore **merges/upserts** supported application records and preserves existing user accounts/audit logs; it is **not** equivalent to a complete PostgreSQL point-in-time restore.
- The project records sensitive actions in tenant-scoped system audit logs. Authorized financial corrections should leave an audit trail.

## Financial rules

The following invariants are more important than any individual screen:

1. **No fictitious receipts:** An OR represents a committed payment. Resending/reprinting an OR never adds income.
2. **No double-counted cash:** University Cashier safekeeping moves custody, not income; assessed unpaid dues are not carried over as available cash.
3. **No silent reassignment:** Cash received must reach the approved fund, including each tenant's Penalty Fund for newly linked penalty cash receipts.
4. **No silent deletion:** Voids reverse the relevant ledger and student-obligation effect when permitted, while retaining the original transaction and reason.
5. **Tenant and period isolation:** Each action must verify authorization, organization, accounting period, and closure status on the server.
6. **Historical arrears survive rollover:** A closed term does not erase a student's outstanding assessed obligations.
7. **Email is not the ledger:** An unsent or duplicated notification cannot change the underlying posted transaction.

## Technology

| Component | Technology |
| --- | --- |
| Application | Next.js **16.3.8**, App Router, Server Actions, Turbopack |
| Language/runtime | TypeScript, React 19, Node.js |
| Data | PostgreSQL (Neon supported), **Prisma 5.22** |
| Authentication | Auth.js / NextAuth v5 with OTP credentials |
| Hosting | Vercel; GitHub source control |
| Storage | Vercel Blob for supported logo/attachment workflows |
| Email | Nodemailer over SMTP, transaction outbox and scheduled retries |
| UI | Bootstrap, Bootstrap Icons, SweetAlert2, shared CLEAR theme-adaptive dialogs |

## Getting started

### Requirements

- Node.js **20.9+** (a current supported LTS release is recommended) and npm.
- PostgreSQL database / separate Neon branch for development or staging.
- Working SMTP account if testing OTP or emailed receipts.
- A server-side environment configuration; do **not** commit credentials.

### Clone and install

```cmd
 git clone https://github.com/engrken/CLEAR.git
 cd CLEAR
 npm install
 npx prisma validate
 npx prisma generate
```

`npm install` also runs Prisma generation when the project's `postinstall` script is configured.

### Configure your local environment

Create `.env.local` at the project root. Use **staging-only credentials and database URLs** for financial workflow testing. Consult the next section for the variable names.

### Start and verify

```cmd
npm run dev
```

Open `http://localhost:3000`. Useful pages:

- `/dashboard` — tenant directory / administrative access.
- `/dashboard/provisions` — Super Admin provisioning.
- `/department/<tenant>` — department landing/workspace.
- `/department/<tenant>/setup` — funds and academic calendar.
- `/department/<tenant>/setup/collections` — Fee Setup.
- `/department/<tenant>/collections` — payments.
- `/department/<tenant>/collections/history` — issued OR history.
- `/department/<tenant>/collections/arrears` — previous-period assessed debts.
- `/department/<tenant>/clearance` — public clearance and authorized officer views.

Run a production compilation before creating a release:

```cmd
npx prisma validate
npx prisma generate
npm run build
```

For production-mode local benchmarking, use `npm run start` after a successful build, with a **nonproduction** database.

## Environment configuration

These examples are **placeholders**, never actual values. Environment requirements depend on the features enabled and your deployed code; check the current source before changing existing secrets.

```dotenv
# PostgreSQL / Neon (use the correct branch for each environment)
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# Auth.js and administrator authorization
AUTH_SECRET="GENERATE_A_STRONG_RANDOM_SECRET"
NEXTAUTH_URL="http://localhost:3000"
SUPER_ADMIN_EMAIL="admin@example.edu"

# Optional clearance signature secret; check current implementation for fallback behavior
CLEARANCE_SALT="GENERATE_A_SEPARATE_RANDOM_SECRET"

# OTP and transaction-email SMTP (server-side)
SMTP_HOST="smtp.example.edu"
SMTP_PORT="465"
SMTP_USER="smtp-user@example.edu"
SMTP_PASSWORD="YOUR_SMTP_PASSWORD"
MAIL_FROM="CLEAR System <receipts@example.edu>"

# Uploaded branding and receipt evidence (if Vercel Blob is used)
BLOB_READ_WRITE_TOKEN="YOUR_VERCEL_BLOB_TOKEN"

# Encrypted backups: KEEP EXISTING KEY if backups have already been created
BACKUP_ENCRYPTION_KEY="YOUR_EXISTING_64_CHARACTER_HEX_KEY"

# Scheduled encrypted backup and email retry authorization
CRON_SECRET="A_SEPARATE_STRONG_RANDOM_SECRET"

# Optional routine transaction-email preference management
EMAIL_PREFERENCES_SECRET="ANOTHER_STRONG_RANDOM_SECRET"
EMAIL_PREFERENCES_BASE_URL="http://127.0.0.1:3000"
```

**Important details:**

- The current shared mailer expects **`SMTP_PASSWORD`**; older documentation used `SMTP_PASS`. Verify the value consumed by `lib/mailer.ts` rather than assuming the names are interchangeable.
- Some earlier clearance implementations used `CLEARANCE_SECRET`, while newer code may read **`CLEARANCE_SALT`**; confirm the exact name in your consolidated codebase before deployment. Do not casually rotate a key used to validate existing QR signatures.
- `NEXTAUTH_URL` and/or `AUTH_URL` depend on the active Auth.js configuration and deployment. Use the deployment's actual HTTPS origin where explicitly required.
- In Vercel, set `EMAIL_PREFERENCES_BASE_URL=https://<your-real-clear-domain>` (no trailing path). `127.0.0.1` is only for local development.
- `CRON_SECRET` authorizes scheduled endpoints; it is **not** the backup encryption key. Vercel's value may differ from your local test secret.
- **Keep an existing `BACKUP_ENCRYPTION_KEY` unchanged** if earlier encrypted backups depend on it. Preserve recovery copies of all encryption keys securely, separate from backup files.
- Never expose secrets with a `NEXT_PUBLIC_` prefix, commit `.env*`, paste session cookies into issues, or commit load-test session fixtures.

Generate a strong random secret locally (repeat for independent keys):

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### Scheduled jobs

| Endpoint | Purpose | Authorization |
| --- | --- | --- |
| `/api/cron/backup` | Automated encrypted backup | Protected scheduler endpoint |
| `/api/cron/digital-receipts` | Retry pending/failed transaction emails | `Authorization: Bearer <CRON_SECRET>` |

Configure schedules in Vercel or another trusted scheduler according to your hosting plan. **Setting `CRON_SECRET` alone does not schedule either job.** Verify each deployed endpoint's authentication and inspect job outcomes.

## Database schema and migration safety

**Existing Neon installations need special care.** This project's development history has included live database schema changes and previously reported migration drift. Some database-applied migration versions were missing from a local `prisma/migrations` directory.

**Never accept Prisma's prompt to reset a database containing financial data.** In particular, do not run `prisma migrate reset`, `prisma db push --force-reset`, or destructive schema sync commands against production.

### For existing databases

1. Create an independently restorable PostgreSQL backup and a **Neon staging branch**.
2. Confirm the local `prisma/schema.prisma` includes the current models **and their inverse relation fields**.
3. Compare the staging schema with the additive SQL upgrade scripts applied during development (academic calendar, period transition, arrears links, penalty events, digital receipt outbox, email preferences).
4. Reconcile the missing migration folders/history as a separate planned task. Do not edit `_prisma_migrations` manually to hide drift.
5. After schema consistency is confirmed:

```cmd
npx prisma format
npx prisma validate
npx prisma generate
npm run build
```

`prisma validate`, `prisma generate`, and a successful TypeScript build **do not prove** that the live database contains every table, index, or foreign key. Verify the schema in Neon independently. For new clean installations, adopt one controlled, versioned migration process rather than relying indefinitely on manually executed SQL.

### Schema extensions introduced in recent releases

| Area | Schema concepts |
| --- | --- |
| Tenant academic calendar | `AcademicPeriodConfig` |
| Controlled closure and arrears | `AcademicPeriodTransition`, `ArrearPaymentLink` |
| Penalty classifications/history | Penalty type fields, `PenaltySettlementEvent` |
| Email delivery | `DigitalReceiptDelivery` |
| Recipient preferences | `TransactionEmailPreference` |

Do not replay historical upgrade scripts against an existing database without inspecting its schema first.

## Application routes and project structure

```text
app/
├── api/
│   ├── auth/[...nextauth]/           # Authentication
│   ├── backup/                       # Authenticated encrypted backup export
│   ├── restore/                      # Verified tenant backup restore
│   └── cron/
│       ├── backup/                   # Scheduled backup
│       └── digital-receipts/         # Outbox retry dispatcher
├── dashboard/
│   └── provisions/                  # Super Admin tenant provisioning
├── department/[department]/
│   ├── clearance/                   # Public/authorized clearance
│   └── (protected)/
│       ├── advances/                # Issuance, history, cancellation
│       ├── cashier-remittance/      # Cashier custody deposits/withdrawals
│       ├── collectibles/           # Assessed dues, history, voids
│       ├── collections/
│       │   ├── arrears/             # Current-period payments for old debts
│       │   └── history/             # Issued receipts, reprint, resend
│       ├── email-preferences/       # Officer receipt-notification preferences
│       ├── liquidations/           # Audits and liquidation reversals
│       ├── logs/                   # System audit logs
│       ├── penalties/              # Fine types, settlements, history
│       ├── realign/                # Fund transfers, closing and rollover
│       ├── remittances/            # Online proof approval/rejection
│       ├── reports/                # Detailed reports
│       ├── setup/                  # Calendar, pools and fee setup
│       ├── students/               # Enrollment, import, promotion
│       ├── summary/                # Aggregated summary reports
│       ├── users/                  # Account administration
│       └── void/                   # Audited, authorized reversals
├── email/preferences/             # Secure recipient preference links
└── globals.css
lib/
├── academic-periods.ts             # Academic calendar helpers
├── backup-security.ts              # AES-GCM authenticated backup helpers
├── clear-dialogs.ts                # Shared theme-adaptive dialogs
├── digital-receipts.ts             # Notification queue/delivery
├── transaction-email-preferences.ts# Recipient subscription rules
├── logger.ts                        # System action logging
├── mailer.ts                        # SMTP integration
├── permissions.ts                   # Role, tab and tenant checks
├── prisma.ts                        # Prisma client
└── tenant.ts                        # Tenant query helpers
prisma/schema.prisma                 # Authoritative ORM model definitions
auth.ts                              # Auth.js session/credentials callbacks
proxy.ts                             # Next.js 16 proxy/subdomain handling
next.config.ts                       # Next.js configuration
```

Exact files may vary with the patches installed. Run `git status` and review source diffs before assuming every route/helper above is present in a checkout.

## Verification and UAT

### Automated checks

From the project root:

```cmd
npx prisma validate
npx prisma generate
npm run build
```

Additional `scripts/test-*.cjs`, `scripts/verify-*.cjs`, and read-only audit utilities accompany specific releases. Run only scripts that actually exist in your project and review any `--apply` flag before executing it. See the release-specific READMEs for expected outputs.

### Manual acceptance checklist (staging test data)

- [ ] Tenant onboarding: create Full Year, Semester, and Trimester test organizations; verify first period and permissions.
- [ ] Academic-year transition: close a period, carry available funds to next General Fund, activate the correct period; ensure old-period posting is blocked.
- [ ] Historical arrears: unpaid prior-year assessed penalties/collectibles hold clearance; current-year OR settles the original obligation.
- [ ] Fee Setup: standalone/package funds align with Collections and Collectibles.
- [ ] Collections: split payments, OR uniqueness, fund posting, correct student, and receipt history reprint.
- [ ] Email: student/officer copies, individual opt-outs, retry processing, and resends; no new money booked by resending.
- [ ] Penalties: partial/full cash payments, service credits, Late Fee cash-only rule, Penalty Fund, settlement history.
- [ ] Collectibles: partial payments, historical payment links, category-safe matching, receipt void restoring balance, assessment void.
- [ ] Remittances: approve/reject notices and properly linked approved-payment reversal.
- [ ] Advances/liquidations: fund availability, liquidation reversal, advance cancellation with audit history.
- [ ] Cashier custody: deposit/withdrawal changes custody but not fund income.
- [ ] Void Center: permission checks, reason, search/pagination, linked reversals, nonnegative-fund safeguards.
- [ ] Reports: verify category totals, gross collections, audited expenses, net balances, and absence of student-level details in Summary.
- [ ] User Management: reject self-deactivation/deletion and prevent cross-tenant actions.
- [ ] Backup security: valid encrypted restore succeeds on **staging**; tampered/foreign-tenant backup is rejected and changes no records.
- [ ] Public clearance discloses only status; officer view shows authorized details.
- [ ] Light and dark dialogs work, and unsuccessful transactions do not unexpectedly clear input fields.

**Known prior test evidence:** Local builds, read-only financial audits, and the encrypted-backup tampering/restore tests have succeeded during development. A prior read-only audit also identified an **older remittance/void status discrepancy** resulting from transactions voided before the coordinated reversal update. Record and reconcile such legacy exceptions before claiming a clean ledger. No validated 50-concurrent-user benchmark has been completed; performance/load testing was deferred until the user-testing phase.

### Recommended pilot strategy

Use a dedicated Vercel **Preview** deployment and Neon **staging** database with synthetic students, accounts, and financial records. Begin with a small authorized test group. Collect reproducible issue reports (module, academic period, steps, expected/actual outcome, and redacted logs). Do not use real student payments until finance, access control, restore, and reversal tests pass.

## Deploying to Vercel

1. Confirm your final local `npm run build` succeeds **after all patches have been combined**.
2. Review `.gitignore` and exclude `.env*`, private keys, backup exports, session cookies, SQL dumps, test credentials, and generated local patch backups.
3. Create a pilot branch instead of immediately updating production:

   ```cmd
   git switch -c pilot-testing
   git add README.md
   git add app lib prisma scripts auth.ts proxy.ts next.config.ts
   git diff --cached --name-only
   git commit -m "chore: prepare CLEAR pilot release"
   git push -u origin pilot-testing
   ```

   Review changed/untracked files before staging; the `git add` commands are illustrative and may need adjustment for your checkout.
4. In Vercel, configure Preview variables for a **separate Neon staging branch**, authentication, SMTP, encrypted backup key, digital-receipt email preferences, and the expected public HTTPS base URL.
5. Confirm any required additive schema changes exist on the **same Neon branch** connected to Preview before testing payment routes.
6. Verify that automatic backup and email retry cron jobs are actually scheduled and authenticated.
7. After deployment becomes **Ready**, validate tenant login, clearance, Collections/OR history, fee setup, financial reversals, receipt email preferences, and backups on synthetic data.
8. Promote via review/merge only when UAT is satisfactory and the production database, secrets, and migration state have been independently verified.

For Vercel, a Git-connected repository can automatically deploy Preview branches; pushing to the configured production branch can deploy to the live site.

## Security and operational notes

- Server actions and API routes must verify **tenant membership, role/tab access, record ownership, period state, and authorization**—UI buttons are not security boundaries.
- The system stores sensitive student identities, payment data, and financial logs. Limit access, use TLS, follow applicable privacy rules, and define retention/incident-response procedures before production use.
- Audit rows are retained by the application; calling them **cryptographically immutable** would require additional controls such as append-only storage or independent integrity verification.
- An encrypted authenticated backup can still be **deleted** or replaced by an older valid backup. Keep separate versioned, access-controlled backups and test PostgreSQL-native disaster recovery.
- Never manually rewrite a posted financial transaction just to remove a validation error. Apply a documented, authorized reconciliation instead.
- Prisma schema drift is unresolved until the migration history is formally reconciled. Treat schema changes as controlled operations.
- SMTP is at-least-once; a rare retry can duplicate an email, **not** the underlying financial posting.
- Older finance records with ambiguous item descriptions or no reliable assessment/receipt link may need supervised historical reconciliation.

## Known limitations and roadmap

- **UAT pending:** Recent features have been delivered in successive releases; the latest combined checkout still needs complete regression testing on Vercel Preview.
- **Capacity unverified:** 50-concurrent-user k6 testing was prepared but deferred; no throughput/SLO claim is made.
- **Schema migration drift:** Reconcile and version the existing Neon migration history before subsequent production schema upgrades.
- **Monetary precision:** Parts of the existing Prisma schema use `Float` for currency; consider a carefully reconciled migration to `Decimal`/integer minor units.
- **Legacy historical debt links:** Some older payments cannot be safely auto-associated without a unique reference.
- **Backup scope:** Application-level encrypted restore is not a substitute for full PostgreSQL snapshots and recovery drills.
- **Email monitoring:** Operational delivery-failure review, retention policies, and monitoring should be finalized for production.
- **Performance:** Review composite database indexes, server pagination, and Prisma connection pooling as tenant and transaction volumes increase.

## Repository and credits

- Source repository: [github.com/engrken/CLEAR](https://github.com/engrken/CLEAR)
- Developed for institutional financial transparency, auditable student clearance, and accountable fund administration.

**Release guidance:** Treat the code as a **pilot/UAT candidate** until the deployed version, its database schema, permissions, and financial reversals have all been tested together.
