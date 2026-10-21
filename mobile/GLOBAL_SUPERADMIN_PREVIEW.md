# CLEAR Android PR #41 — Global Superadmin Preview rollout

Only use the `android-parity-integration` branch. DO NOT deploy PR #41 to
production or enable Android financial writes.

## What changed

- A separate mobile Global Superadmin email-OTP entry and sign-in screen
- Reuse of the web `issueSuperAdminOtp` / `verifySuperAdminOtp` policies
- SHA-256-hashed, revocable, **six-hour** global mobile sessions
- Global membership and session-version revalidation on every privileged request
- Read-only organization overview and registered global-admin counts
- No tenant officer impersonation, provisioning, payment writes, or global-admin
  tokens accepted by officer endpoints

## Database migration — ANDROID PREVIEW ONLY

1. In Neon `clear-sys-db`, choose **clear-android-pr41-preview-20261021**
   (`br-crimson-sea-b3uiuqe1`).
2. Copy a **DIRECT (unpooled)** PostgreSQL connection string from this branch.
   It must contain host
   `ep-cool-thunder-b3wwjz4j.c-4.ap-southeast-1.aws.neon.tech`.
   Do not copy production's connection string. Do not send the URL to ChatGPT.
3. Open PowerShell in the **repository root** after pulling PR #41:

```powershell
git switch android-parity-integration
git pull --ff-only origin android-parity-integration

$secret = Read-Host "Paste DIRECT Android Preview Neon URL (hidden)" -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new("", $secret).Password

try {
  if ($env:DATABASE_URL -notmatch 'ep-cool-thunder-b3wwjz4j\.c-4\.ap-southeast-1\.aws\.neon\.tech') {
    throw "Not the intended Android Preview database. STOP."
  }
  npx prisma migrate status
  # STOP if the pending list contains anything other than
  # 20261021173000_global_mobile_sessions.
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "Migration failed. Stop testing." }
  npx prisma migrate status
} finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
```

The preflight step must show only the expected pending migration; do not run
`migrate deploy` if it reports additional unexpected migrations.

## Vercel Preview

- Branch-specific `DATABASE_URL` for `android-parity-integration` must
  point to the pooled host
  `ep-cool-thunder-b3wwjz4j-pooler.c-4.ap-southeast-1.aws.neon.tech`.
- Confirm Preview has `AUTH_SECRET` or `NEXTAUTH_SECRET` (at least 32 chars),
  `SMTP_USER`, `SMTP_PASSWORD`, and the mail transport variables used by
  `lib/mailer.ts`; do not disclose their values.
- If the global admin is the bootstrap account, Preview also needs the correct
  `SUPER_ADMIN_EMAIL`. A global admin saved in `GlobalSuperAdmin` does not
  need the bootstrap environment variable.
- OTP confirmation is intentionally non-enumerating even when mail delivery is
  unavailable; investigate Vercel server logs, not the public API response.
- Redeploy the `android-parity-integration` Preview after changing settings.

## Validation

1. `npm ci && npm run build` from repository root
2. `cd mobile && npm ci && npm run typecheck`
3. Check an unauthenticated GET to `/api/mobile/global/overview` returns 401.
4. Test global OTP issuance, 60-second cooldown, incorrect OTP rejection,
   success, the read-only overview, sign-out and token rejection after sign-out.
5. Test both switching from a signed-in department officer and independent
   global sign-in. A global token must fail at the officer endpoints.
6. From `mobile`: `npx eas-cli build --platform android --profile preview`.

Important: the exposed Preview deployment contains copied production data.
Do not enable provisioning or financial writes. Revoke the public domain
exception after testing or sanitize the Preview database.
