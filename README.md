# CLEAR System

**Centralized Liquidation of Expenses & Audit Records**

CLEAR is a **multi-tenant, web-based financial administration and student clearance system** for schools, academic departments, and student organizations. It combines student enrollment records, collection fees, official receipts, remittance review, funds management, penalties, receivables, cash advances, liquidation, audit reports, and student clearance in a tenant-scoped workspace.

> **Release status (23 October 2026):** The CLEAR **web application is deployed** at [clearsys.vercel.app](https://clearsys.vercel.app) (Vercel reports the latest reviewed deployment READY). The owner confirms **Android v1.2.0 is publicly published on Google Play**: it was **built locally on the owner's workstation, signed separately by Rupert, then published**. GitHub's internal debug-signed QA APK is *not* that official release. A deployed system still requires ongoing UAT, independently verified authorization, privacy and financial controls, and performance testing; no 50-user-capacity or penetration-test certification is claimed.

## Contents

- [Release status and recent changes](#release-status-and-recent-changes)
- [Capabilities](#capabilities)
- [Financial rules](#financial-rules)
- [Technology](#technology)
- [Getting started](#getting-started)
- [Workstation synchronization and local testing](#workstation-synchronization-and-local-testing)
- [Environment configuration](#environment-configuration)
- [Database schema and migration safety](#database-schema-and-migration-safety)
- [Application routes and project structure](#application-routes-and-project-structure)
- [Verification and UAT](#verification-and-uat)
- [Deploying to Vercel](#deploying-to-vercel)
- [Security and operational notes](#security-and-operational-notes)
- [Known limitations and roadmap](#known-limitations-and-roadmap)

## Release status and recent changes

| Surface | October 2026 status | Release distinction |
| --- | --- | --- |
| **Web Production** | [clearsys.vercel.app](https://clearsys.vercel.app), GitHub `main` to Vercel; latest checked deployment READY | A READY deployment alone does not prove end-user smoke testing or the actual decrypted Vercel database binding. |
| **Public Android app** | **v1.2.0** publicly available on Google Play (owner-confirmed) | Built on the local workstation, **signed separately by Rupert**, and published to Play; do not confuse with the GitHub QA build. |
| **Next Android update** | Collecting approved changes into a **future major release** | [Issue #61](https://github.com/engrken/CLEAR/issues/61) tracks changes; no immediate APK/AAB upload. |
| **Source** | [GitHub `engrken/CLEAR`](https://github.com/engrken/CLEAR) | Merging `main` may trigger a new **web** deployment, not a Play Store update. |

### Key merged changes

- **[PR #46](https://github.com/engrken/CLEAR/pull/46):** Production-backed, read-only mobile viewer controls, fail-closed mobile business-write policy, separate student/officer/global sessions, and the tenant-admin portal. Security/session maintenance exceptions do **not** authorize financial or provisioning transactions.
- **[PRs #49 / #52](https://github.com/engrken/CLEAR/pull/52):** native mobile welcome/landing and role entry.
- **[PR #56](https://github.com/engrken/CLEAR/pull/56):** registered-email OTP-based private web clearance and removal of third-party QR image generation. Signed certificate verification links remain; first-party QR graphics require [issue #57](https://github.com/engrken/CLEAR/issues/57).
- **[PR #60](https://github.com/engrken/CLEAR/pull/60):** period-specific `Enrolled` package eligibility, `Not enrolled` handling and historical-debt safeguards; synchronized read-only financial overview; OTP-verified profile email updates; mobile privacy notice; same-page officer presence, role-aware first-time onboarding, and safer confirmation dialogs. Associated additive Production migration was applied with backup/recovery verification and financial-integrity checks.
- **[PR #59](https://github.com/engrken/CLEAR/pull/59):** `mobile/.gitignore` signing-secret/keystore protections; this does **not** change or resign Android v1.2.0.
- **[PR #53](https://github.com/engrken/CLEAR/pull/53):** GitHub-native **internal/debug-signed QA APK** workflow, not valid for Google Play distribution under Rupert's official signing identity.

**Verification versus implementation:** These changes are in merged source, but real-device student OTP delivery, role/tenant isolation with authorized accounts and runtime Production database-binding attestation still require careful end-to-end verification. See [student inquiry #47](https://github.com/engrken/CLEAR/issues/47), [privacy review #50](https://github.com/engrken/CLEAR/issues/50) and [read-only rollout gates](docs/mobile-production-readonly-gates.md).

## Capabilities

### Multi-tenant onboarding and access control

- Organization/department workspaces at `/department/[department]`, with department-specific financial records and branding.
- Super Admin provisioning under `/dashboard/provisions`, including a tenant's initial academic year, school calendar, and administrator.
- Guided first-time setup for **fund pools** and **collection fees**.
- OTP-based authentication with Auth.js/NextAuth; role-based and tab-based permissions enforced by server actions.
- Tenant-scoped permissions for financial posting, reports, reversal, setup, and user management. A user cannot use User Management to deactivate or delete their **own current account**.
- Student self-service clearance is protected by registered-email OTP and short-lived, tenant/student-bound authorization; the response is minimal and distinct from officer-only financial detail. Environment-specific email, identity and device QA remain release gates.

### Live mobile viewer and authorization policy

| Viewer | Intended live scope | Restrictions |
| --- | --- | --- |
| Student | Their own clearance decision and academic period after registered-email OTP | No arbitrary ID/email search, other students' details, balances or financial writes |
| Officer | Live information in authorized tenant and explicitly assigned tabs | No cross-tenant or unauthorized modules; Production business transactions denied |
| Tenant administrator | Own organization portal, status and permitted overviews | No access to other tenant data or mobile financial/provisioning writes |
| Verified global superadmin | Read-only global overview and authorized cross-tenant access | Independent global sessions; no officer impersonation or business writes |

Authentication/OTP, session revocation and security logging may write **security metadata**; they do not authorize changes to money, fee assessment, tenant provisioning or other business records. The API must enforce checks server-side. Merged viewer functionality is **not a claim of completed real-device/public-v1.2.0 acceptance testing**.

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
8. **Term-specific package eligibility:** Current mandatory package dues depend on an explicit matching `Enrolled` student-period record; missing enrollment must not create phantom new debt or a false clearance. Preserve valid previously assessed obligations.

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
| Android source | Expo SDK 58, React Native 0.88, Expo Router; app version `1.2.0` in `mobile/app.json` |

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
npm ci
npx prisma validate
npx prisma generate
```

Use `npm ci` for lockfile-pinned dependencies (the project also runs Prisma generation on `postinstall`). Installing dependencies and generating Prisma client do **not** authorize a database migration.

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

## Workstation synchronization and local testing

**Windows workstation reference (23 October 2026)**

| Purpose | Local path |
| --- | --- |
| Intended permanent Git-managed source | `D:\clear-system-saas` |
| Local web address | `http://localhost:3000` |
| Private local environment | `D:\clear-system-saas\.env.local` (ignored by Git) |
| Disposable mobile build workspace | `D:\c\mobile` |
| Expo-generated Android native project | `D:\c\mobile\android` |

The older `C:\Users\kentb\Desktop\clear-system-saas` checkout was relocated. A fresh Git clone on `D:\clear-system-saas-fresh` was verified clean at `main` commit `3a443f3` before renaming; **verify the fresh clone has actually become `D:\clear-system-saas` on your workstation**. Do not `git init` an existing non-Git folder or discard the original backup, local `.env.local`, or signing-related material.

For a **clean, Git-enabled** permanent checkout, run PowerShell:

```powershell
Set-Location "D:\clear-system-saas"
git status
git fetch origin --prune
git switch main
git pull --ff-only origin main
npm ci
npx prisma generate
npm run dev
```

Stop if Git detects local modifications or cannot fast-forward; never use `git reset --hard` as a shortcut. Open `http://localhost:3000` for web testing after nonproduction environment setup. Test the Android source without producing an APK:

```powershell
Set-Location "D:\clear-system-saas\mobile"
npm ci
npm run typecheck
```

Reserve `D:\c\mobile\android` for a separately approved **disposable native QA build**; normal `git pull` or localhost usage does not require rebuilding v1.2.0. Play signing stays private, with the release workflow coordinated with Rupert. See [major-release tracker #61](https://github.com/engrken/CLEAR/issues/61) and [historical internal-QA signing gate #58](https://github.com/engrken/CLEAR/issues/58).

## Environment configuration

These examples are **placeholders**, never actual values. Environment requirements depend on the features enabled and your deployed code; check the current source before changing existing secrets.

**Database environment source of truth:** [docs/database-environment-reference.md](docs/database-environment-reference.md). For localhost, the **intended E2E staging** Neon branch is `br-solitary-morning-b3amr5wy` (`clear-v24-e2e-staging-20261020`), database `neondb`, direct host `ep-tiny-violet-b39872ht.c-4.ap-southeast-1.aws.neon.tech`. Obtain the *complete connection string privately in Neon* and put it in your ignored `.env.local`; never paste a credential-bearing `DATABASE_URL` into GitHub or chat. Do not substitute Production or Android Preview.

**Important (verified 23 October 2026):** The selected E2E staging branch currently has **9 completed Prisma migrations**, whereas Production has **11**. Staging is missing the global-mobile-session and officer-presence/onboarding migrations. It is **not yet confirmed to support all current `main` features**; migration compatibility requires a separate reviewed staging procedure. Staging was branched from Production and may contain copied private student data—use synthetic/sanitized identities and never send test emails to real students.

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

**Existing Neon installations need special care.** As verified on 23 October 2026, the Neon default/primary Production branch `br-calm-dew-b3vd1ira` recorded **11 completed and zero failed Prisma migrations**, including PR #46 global mobile sessions and PR #60 officer presence/onboarding. The independent E2E staging branch was **two migrations behind (9 completed)**. Distinguish this *staging mismatch* from historical Production drift; check branch IDs and current migration registries before acting. [Environment reference](docs/database-environment-reference.md).

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
| Global mobile sessions | `GlobalMobileSession` (PR #46 Production migration completed) |
| Officer page presence/onboarding | `OfficerPagePresence`, `TenantUser.onboardingSignature` (PR #60 Production migration completed) |

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
npm run test:finance
npm run test:mobile-roles
npx tsc --noEmit
npm run build
```

Run `npm ci && npm run typecheck` separately from `mobile/` for the Android source. Never run business-posting tests against live Production data.

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
- [ ] Registered-email OTP reveals only the verified student's clearance status; reject account enumeration, cross-tenant and student A→B requests, used/expired codes and revoked sessions.
- [ ] Validate officer, tenant-admin and global-superadmin session scoping on authorized devices, including denied business writes.
- [ ] Verify signed certificate links; first-party scannable QR remains gated by [#57](https://github.com/engrken/CLEAR/issues/57).
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
- Production has the approved 11 migrations as of the 23 October 2026 check; the E2E staging branch still lacks two. Keep schema changes controlled and independently verified rather than replaying old migrations.
- SMTP is at-least-once; a rare retry can duplicate an email, **not** the underlying financial posting.
- Older finance records with ambiguous item descriptions or no reliable assessment/receipt link may need supervised historical reconciliation.

## Next patch — financial centavos, historical audit and read efficiency (draft)

The next shared web/mobile patch stages a deterministic integer-centavo allocation for **legacy single-line package receipts**, retaining the original stored receipt and ledger rows. Both financial summary engines use the same helper and load only necessary student fields. The historical arrears service retrieves recognized student-linked assessments with narrower projections; web Receipt History uses a narrower **exact-OR lookup** and flags legacy sub-cent anomalies for review. These are **unmerged source changes**, not a Production schema conversion or a new published Android app.

The broader, controlled backlog remains: [exact-money migration #68](https://github.com/engrken/CLEAR/issues/68), [supervised historical reconciliation #69](https://github.com/engrken/CLEAR/issues/69), and [measured web/mobile performance #70](https://github.com/engrken/CLEAR/issues/70). The [next-patch runbook](docs/financial-precision-history-performance-next-patch.md) specifies staging schema parity, centavo conservation, tenant isolation, performance baselines, regression tests, backups and no silent legacy changes. Mobile source parity is mandatory under #64; Google Play release proceeds separately through #61 after device QA and official signing.

## Known limitations and roadmap

- **Production access acceptance:** The web is deployed but OTP email delivery, actual student-private clearance, device-based officer/tenant-admin/global-admin role access, and Vercel runtime database binding require independent verification. [Issue #47](https://github.com/engrken/CLEAR/issues/47) · [Read-only gates](docs/mobile-production-readonly-gates.md).
- **Clearance privacy and QR:** Private web clearance code is merged via PR #56; external QR graphics were deliberately disabled. First-party QR and legacy verification/disclosure review remain [#57](https://github.com/engrken/CLEAR/issues/57) and [#50](https://github.com/engrken/CLEAR/issues/50).
- **Local test database:** E2E staging has 9 migrations versus Production's 11 (23 October 2026). Test with a reviewed, schema-compatible isolated branch; **do not point localhost at Production as a workaround**.
- **Android release:** v1.2.0 is already publicly published. Accumulate the next major release under [#61](https://github.com/engrken/CLEAR/issues/61) rather than creating a Play submission for every web/PR patch. Reconfirm Play versionCode, the installed package and Rupert's release/upload signing identity before a future AAB. Historical [#58](https://github.com/engrken/CLEAR/issues/58) concerns *debug-signed internal QA*, not the official published v1.2.0 artifact.
- **Capacity:** No independently validated 50-concurrent-user throughput/SLO benchmark is claimed.
- **Currency types:** Existing Prisma `Float` currency fields warrant a later carefully rehearsed and financially reconciled `Decimal`/integer-minor-units migration.
- **Historical payment associations:** Ambiguous legacy receipts, penalties and arrears links need supervised reconciliation, never guessed joins or retrospective OR changes.
- **Operations:** Application-encrypted backups do not replace PostgreSQL snapshots/recovery rehearsals. Strengthen email delivery monitoring, retention and incident response.
- **Scale:** Review indexes, pagination, pooling and tenant isolation as the live workload grows.

## Repository and credits

- Source repository: [github.com/engrken/CLEAR](https://github.com/engrken/CLEAR)
- Developed for institutional financial transparency, auditable student clearance, and accountable fund administration.

**Release guidance:** The web is deployed and Android v1.2.0 is public, but their existence does not close privacy, authorization, financial-regression, staging-parity or resilience tests. See [database environment reference](docs/database-environment-reference.md) and [Android roadmap #61](https://github.com/engrken/CLEAR/issues/61).
