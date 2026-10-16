# CLEAR System (Centralized Liquidation of Expenses & Audit Records)

**CLEAR System** is an enterprise-grade, multi-tenant financial management, expense liquidation, and student clearance platform designed for academic departments and student organizations. Built with Next.js 16 (App Router), Prisma ORM, and Auth.js, it provides strict tenant isolation, cryptographic clearance verification, automated fee splitting, and tamper-evident audit trails.

---

## 🚀 Key Features & Modules

### 1. Multi-Tenant Institutional Architecture
* **Isolated Department & Organization Spaces:** Provision dedicated workspaces for academic departments and student chapters under `/department/[subdomain]`.
* **Super Admin Provisioning Center:** Centralized administrative portal (`/dashboard/provisions`) for onboarding new entities, configuring organizational logos, and assigning initial department administrators.
* **Dynamic Academic Calendar:** Per-tenant configuration of active Academic Years (`activeAy`) and Terms (`activeTerm`), allowing seamless historical ledger switching and balance rollovers.

### 2. Collections & Remittance Engine
* **Automated Fee Package Splitting:** Dynamically splits bundled departmental fees across designated fund sources while supporting standalone collections, merchandise, and penalty settlements.
* **Online Remittance Verification Queue:** Students can upload payment proofs via the public clearance portal, which officers review, verify, or reject before official receipt (OR) issuance.
* **University Cashier Safekeeping Tracker:** Tracks physical deposits and withdrawals between the organization's treasury and the university cashier to distinguish *Balance in Safekeeping* from *Physical Cash on Hand*.

### 3. Cash Advances, Liquidations & Realignments
* **Cash Advance Issuance:** Tracks unliquidated cash advances (`amountApproved`, `expectedReturnDate`, and `fundSource`) and automatically deducts active advances from available fund balances.
* **Expense Liquidation & Audit Records:** Itemized expense recording with cloud-hosted receipt proof storage via Vercel Blob.
* **Inter-Fund Realignments & Term Rollovers:** Execute documented fund-to-fund transfers and carry over ending balances to subsequent academic terms.

### 4. Student Roster, Collectibles & Penalties
* **Term-Scoped Enrollment Roster:** Manage student directories with bulk CSV import, year-level promotion, and term-specific enrollment status tracking (`Enrolled` vs. `Inactive`).
* **Collectibles & Sanctions:** Log individual or bulk student assessments, event attendance penalties, fine amounts, and community service hours rendered.

### 5. Public Clearance & Cryptographic QR Verification
* **Real-Time Clearance Status:** Automatically evaluates student clearance per term based on unpaid departmental fees, unliquidated collectibles, and unsettled penalties.
* **HMAC-SHA256 Digital Signatures:** Generates tamper-proof QR verification tokens bound to the student, term, and organization for instant mobile or officer validation.

### 6. Security, Access Control & Auditability
* **Granular Tab-Based RBAC:** Role presets (`Admin`, `Treasurer`, `Auditor`, `Officer`, `Viewer`) combined with customizable per-user tab permissions (`tab-overview`, `tab-payment`, `tab-audit`, `tab-void`, etc.).
* **Passwordless OTP Authentication:** Cryptographically secure 6-digit OTP login flow (`crypto.randomInt` + constant-time verification via `crypto.timingSafeEqual`).
* **Administrative Void & Reversal Center:** Controlled reversal of Official Receipts, penalties, cash advances, and collectibles with mandatory reason logging and non-destructive status transitions.
* **Immutable System Audit Logs:** Automatic tracking of all sensitive mutations (`RECORD_COLLECTION`, `ISSUE_ADVANCE`, `RECORD_AUDIT`, `VOID_TRANSACTION`, etc.) and isolated JSON tenant backups.

---

## 🛠️ Technology Stack

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Turbopack)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Database & ORM:** PostgreSQL with [Prisma ORM](https://www.prisma.io/) (v5.22.0)
* **Authentication:** [Auth.js / NextAuth v5](https://authjs.dev/) (JWT Strategy + Custom OTP Credentials)
* **Object Storage:** [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (for organizational logos and receipt attachments)
* **Email Delivery:** [Nodemailer](https://nodemailer.com/) (SMTP / Gmail App Passwords)
* **UI & Styling:** Bootstrap 5, Bootstrap Icons, SweetAlert2 (`ThemedAlert` dark/light mode integration)

---

## 📋 Prerequisites

Ensure you have the following installed on your local machine:
* **Node.js** (v20.x or newer recommended)
* **npm** (v10.x or newer)
* A **PostgreSQL** database instance (local or hosted via Neon, Supabase, or Vercel Postgres)

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory of your project and configure the following variables:

```env
# -----------------------------------------------------------------------------
# DATABASE CONFIGURATION
# -----------------------------------------------------------------------------
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

# -----------------------------------------------------------------------------
# AUTHENTICATION & SECURITY (Auth.js / NextAuth)
# -----------------------------------------------------------------------------
AUTH_SECRET="your-32-character-minimum-cryptographic-secret"
NEXTAUTH_URL="http://localhost:3000"

# Authorized System Super Administrator Email
SUPER_ADMIN_EMAIL="your-admin-email@gmail.com"

# Optional secret used for signing student clearance QR tokens (falls back to AUTH_SECRET)
CLEARANCE_SECRET="your-clearance-hmac-secret-key"

# -----------------------------------------------------------------------------
# SMTP / EMAIL CONFIGURATION (Nodemailer)
# -----------------------------------------------------------------------------
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="your-authenticated-email@gmail.com"
SMTP_PASS="your-16-character-google-app-password"
MAIL_FROM="CLEAR System <your-authenticated-email@gmail.com>"

# -----------------------------------------------------------------------------
# CLOUD STORAGE (Vercel Blob)
# -----------------------------------------------------------------------------
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

> **Note on Gmail SMTP:** When using Gmail (`smtp.gmail.com`), `MAIL_FROM` must match your authenticated `SMTP_USER` email address, and `SMTP_PASS` must be a 16-character **Google App Password** generated from a Google account with 2-Step Verification enabled.

---

## 💻 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/engrken/CLEAR.git
   cd CLEAR
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *(The `postinstall` script will automatically run `prisma generate`.)*

3. **Push the Prisma schema to your PostgreSQL database:**
   ```bash
   npx prisma db push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Access the application:**
   * Public Landing & Directory: `http://localhost:3000`
   * Institutional Dashboard & Super Admin Login: `http://localhost:3000/dashboard`
   * Super Admin Provisioning Portal: `http://localhost:3000/dashboard/provisions`
   * Department Workspace: `http://localhost:3000/department/[subdomain]`

---

## 🗂️ Project Structure

```text
├── app/
│   ├── api/
│   │   ├── auth/              # Auth.js handlers & Super Admin OTP dispatch route
│   │   └── backup/            # Tenant-isolated JSON backup export endpoint
│   ├── dashboard/             # Institutional selector & Super Admin Provisioning Center
│   ├── department/
│   │   └── [department]/      # Multi-tenant departmental workspace
│   │       ├── (protected)/   # Authenticated operational modules:
│   │       │   ├── advances/
│   │       │   ├── cashier-remittance/
│   │       │   ├── collectibles/
│   │       │   ├── collections/
│   │       │   ├── liquidations/
│   │       │   ├── logs/
│   │       │   ├── penalties/
│   │       │   ├── realign/
│   │       │   ├── remittances/
│   │       │   ├── reports/
│   │       │   ├── setup/
│   │       │   ├── students/
│   │       │   ├── summary/
│   │       │   ├── users/
│   │       │   └── void/
│   │       ├── clearance/     # Public & Officer Student Clearance Portal
│   │       ├── actions.ts     # Core financial calculation engine & shared tenant actions
│   │       └── auth-actions.ts# Department-scoped OTP dispatch & verification helpers
│   ├── globals.css            # Theme variables & print stylesheet rules
│   └── page.tsx               # Public landing page
├── lib/
│   ├── alerts.ts              # Theme-adaptive SweetAlert2 wrapper (ThemedAlert)
│   ├── logger.ts              # Non-blocking system audit logger (logSystemAction)
│   ├── mailer.ts              # Lazy-initialized Nodemailer transport
│   ├── permissions.ts         # Server-side RBAC, tab guards & tenant access helpers
│   ├── prisma.ts              # Global Prisma Client singleton
│   ├── tenant.ts              # Prisma multi-tenant query extension helper
│   └── utils.ts               # Currency formatting (fmt) & centavo rounding (money)
├── prisma/
│   └── schema.prisma          # PostgreSQL database schema (18 models)
├── auth.ts                    # Auth.js v5 configuration & OTP verification logic
└── next.config.ts             # Next.js configuration
```

---

## 🚢 Deployment on Vercel

1. Push your code to your GitHub repository (`main` branch).
2. Import the project into **Vercel**.
3. Configure all required **Environment Variables** in the Vercel dashboard (**Settings > Environment Variables**).
4. Deploy! Vercel will automatically run `prisma generate` during `postinstall` and execute `next build`.

---

## 📄 License & Credits

Developed for institutional financial transparency, automated student clearance, and audit readiness.