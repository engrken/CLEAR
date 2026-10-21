# CLEAR Live Viewer — production read-only rollout gates (2026-10-22)

**Scope:** Stage a production-backed, read-only Android client and mobile API. The canonical CLEAR web application remains the **only** interface for financial posting, remittance decisions, voids, penalties, tenant provisioning and subscription changes. Do **not** publish an APK or execute Production migrations as a consequence of merging this PR.

## Access policy

| Actor | Permitted read | Server authorization | Business mutations |
|---|---|---|---|
| Student | Their own clearance state + period + secure verification | Requires a separate student identity-verification gate before calling this production-ready; existing public single-identifier lookup is **not proof of identity** | DENY |
| Officer | Tenant-scoped roster, ledger, pending proofs, summary according to assigned tab grants | Live `MobileSession`, active `TenantUser`, active organization, tenant match, allowed tab | DENY |
| Tenant admin | Own tenant metadata/status/tier/group, active-period counts and authorized officer modules | Same officer/session tenant checks **plus** actual `admin`/`administrator`/`master` database role | DENY |
| Global Superadmin | Read any tenant (including inactive/archived) and global overview | Independent `GlobalMobileSession` with revalidated live global registry membership/session version | DENY |

Read-only is **business-data read-only**: issuing/verifying email OTP codes, sessions, revoking sessions and security/audit metadata necessarily write authentication records. These exceptions are explicitly path/method allow-listed; they do not grant any accounting or provisioning transaction.

## Code-level and database enforcement

- `lib/mobile/production-readonly.ts` denies every mobile business mutation by default, including new routes unless explicitly reviewed. Only OTP and session logout mutations are always allowed.
- Existing Preview-only tenant provisioning POSTs remain allow-listed **only** in `VERCEL_ENV=preview` with exact branch `VERCEL_GIT_COMMIT_REF=android-parity-integration`, and retain their own endpoint-level authorization and typed confirmation gates. They are **not** admitted on Production, another Preview branch, or an unknown environment.
- Server routes still check bearer-token/session status, role, module permission, org ID and active academic term on each request. Client screens are navigation aids, not authorization.
- `GET /api/mobile/orgs/[org]/portal` requires a current active tenant administrator and returns only its own organization metadata and aggregate counts.
- `lib/clearance.ts` now **fails closed** if historical debt evaluation fails. Missing historical arrears must never silently produce a false `cleared` result.
- The Android client still has `PAYMENT_WRITES_ENABLED = false`. Do not remove it or open payment/proof/verification write endpoints.

## Verified Neon observation (read-only SQL, 2026-10-22)

Project `clear-sys-db`, **primary** Neon branch `br-calm-dew-b3vd1ira`:
- `Organization`, `Student`, `MobileSession`, `_prisma_migrations` exist.
- `GlobalMobileSession` does **not** exist, and migration `20261021173000_global_mobile_sessions` is not recorded.
- Aggregate counts at inspection: 3 organizations and 104 students. No individual records were inspected or changed.

**Stop gate:** Do not claim that Production Global Superadmin mobile sign-in works until the Vercel Production `DATABASE_URL` is confirmed to target the intended Neon database branch; the migration is reviewed against current Production, backed up, rehearsed on an isolated Neon branch, explicitly approved for Production, executed and verified. NEVER use `prisma db push` to force Production schema compatibility. Do not run migration or modify Production via this PR.

## Student-clearance privacy stop gate

The existing public web/mobile clearance flow accepts only a school ID **or** registered email. That is a lookup key, not authentication, and can expose whether an account exists or is on clearance hold. Current public mobile responses hide student name, itemized arrears and outstanding amounts, but QR verification URLs may contain school IDs.

Before advertising student clearance as a secure **own-record** Production feature, implement and test:
1. Student identity verification (prefer registered-email OTP with durable request/guess budgets and non-enumerating responses), and a short-lived student-specific read credential.
2. Exact tenant + student binding, anti-enumeration/error-equivalence, rate limiting, minimal clearance status response, safe QR verification behavior, `no-store` headers and absence of student IDs/emails/financial details in analytics/logs.
3. Live financial reconciliation parity against the canonical web clearance algorithm (active package, historical liabilities, penalties, remittances, voids, closed-period rules), with synthetic isolated fixtures and fail-closed failure cases.
4. Public and student-authenticated tests; ensure unauthenticated users cannot enumerate student existence or access balances.

Do not call the current public lookup private/self-service until those gates pass. Existing web clearance remains governed by the web application's own public disclosure policy; this PR does not silently change that contract.

## Before any Production rollout

1. Review/merge this PR after green `test:mobile-roles`, finance tests, root/mobile TypeScript, isolated Next.js build and migration rehearsal. Test tenant-admin vs ordinary-officer denial; one-tenant vs different-tenant token rejection; revoked/offboarded users; global vs officer credentials.
2. Verify Vercel Production deployment SHA == approved `main` commit, and the Production database host/branch via environment metadata without revealing credentials. Preview data is **not** Production.
3. Resolve the missing `GlobalMobileSession` migration using a separate explicitly approved migration runbook; never migrate or create real accounts as a convenience test.
4. On Production, anonymously test protected GET endpoints (401 JSON), tenant-admin denied officer tokens (403), and business write routes (403 `read_only`). Avoid real POSTs that would change user financial/tenant records; only exercise the method guard on isolated staging and via static tests before Production.
5. Confirm TLS/HTTPS, secure bearer storage, OTP delivery policy, sensitive-response caching disabled, audit logs and backup/recovery readiness.
6. Do not repoint the currently queued 1.2.0 Preview APK to Production by changing Vercel aliases. For a new live-data internal APK, set the correct explicit HTTPS Production base URL in a separately reviewed EAS build profile and verify the packaged endpoint, role-based UI and disabled mutations before distribution.
7. Conduct phone QA for JIECEP officer, JIECEP tenant admin, another tenant, Global Superadmin and student self-verification using authorized test identities only. No Production posting, account edits or synthetic data creation on the primary database.

## Rollback

Disable distribution of the new live viewer and revert its Vercel deployment to the previously verified Production revision if any security/financial parity regression appears. No business data migration is part of this PR. Treat authentication-table schema changes as a separately approved, reversible operational procedure with a current snapshot.
