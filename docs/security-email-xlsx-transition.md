# CLEAR security-only dependency transition (staging PR)

Status: **Do not deploy without configuring and verifying the new email provider.**
This PR does not run a database migration, modify Neon, or alter financial records.

## Email

CLEAR currently uses NextAuth Credentials OTP, not its optional Nodemailer email
provider. The direct Nodemailer SMTP implementation is replaced with one
fixed-origin HTTPS request to the Resend email API, using Node's native fetch.

Required Vercel environment variables in **Preview** and, after UAT, Production:

- RESEND_API_KEY: secret key (server-side only; never NEXT_PUBLIC_).
- RESEND_FROM_EMAIL: sender at an explicitly verified domain, such as
  CLEAR System <notifications@your-verified-domain.example>.

The old SMTP_USER/SMTP_PASSWORD/SMTP_HOST/SMTP_PORT settings are deliberately not
used on this branch. Keep production SMTP settings until the new mail path has
been separately verified. All outgoing email is checked for a single recipient
address with no comments, display names or header control characters; malformed
addresses are refused rather than passed to an address parser.

**Critical release gate:** The updated build cannot send officer OTPs, global
Super Admin OTPs or transaction emails without a valid Resend API key AND an
approved RESEND_FROM_EMAIL. Successful CI is insufficient to authorize a merge.

## Manual end-to-end checks on a separate staging Neon branch

1. Verify sending domain, SPF/DKIM and sender permissions with Resend.
2. Log in as an ordinary officer by requesting and consuming a test OTP.
3. Verify Super Admin OTP, pending invites, and account revocation.
4. Verify retry/resend limits and OTP expiry with disposable test accounts.
5. Send a test transaction receipt; verify intended recipient, email content,
   preference opt-out and queue retry behavior.
6. Confirm delivery/bounces in provider logs; an accepted API request alone
   does not establish inbox delivery.
7. Run npm ci, npm audit --omit=dev, npm run build, and all CI tests.
8. Configure production provider variables before any approved merge/deploy.
   Retain a rollback plan that restores the last working Git deployment.

## Legacy Excel seed tool (manual workstation operation only)

The historical seed-excel.js is not a SaaS API route and must never be run
against the live financial database. The vulnerable npm xlsx parser was
removed from production dependencies. For trusted offline/staging workbook
reading the utility now invokes an optional Python openpyxl reader.

Windows workstation setup:

    py -m pip install "openpyxl>=3.1.5,<4"
    set CLEAR_LEGACY_SEED_CONFIRM=STAGING_BACKUP_VERIFIED
    node seed-excel.js

Before executing: verify DATABASE_URL points to a STAGING Neon branch; create
an independent backup. The explicit confirmation string is not a substitute for
checking the actual destination database.

Named legacy worksheets, column headings and ordinary numeric/date values are
kept; extraordinary legacy spreadsheets (formula cells without cached values,
complex merged headings, malformed files) should be reviewed in a manual
dry-run. The optional Python interpreter and package require independent
workstation maintenance.

## Remaining development-tool audit findings

The npm braces/micromatch warning comes from ESLint's developer dependency
chain. The proposed force fix would install eslint-config-next 14.x into a
Next.js 16.3.8 project. Do not use npm audit fix --force. Handle that
separately through a compatible, tested dependency maintenance change.
