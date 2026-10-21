# CLEAR Live Viewer — production read-only rollout gates (2026-10-22)

**Scope:** Stage a production-backed, read-only Android client and mobile API. The canonical CLEAR web application remains the **only** interface for financial posting, remittance decisions, voids, penalties, tenant provisioning and subscription changes. Do **not** publish an APK or execute Production migrations as a consequence of merging this PR.

## Access policy

| Actor | Permitted read | Server authorization | Business mutations |
|---|---|---|---|
| Student | Their own clearance state + period + secure verification | Registered-email OTP + a revocable, tenant- and period-bound, 10-minute student credential; must pass isolated tests before Production | DENY |
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

## Student-clearance privacy and release stop gate

The **staged** mobile route no longer returns an anonymous clearance decision for an arbitrary ID/email: `GET /api/mobile/orgs/[org]/clearance?q=...` requires a live tenant officer with `tab-clearance`, while a student GET without a query requires a student-only bearer credential.

The new mobile student flow requires both an exact school ID **and** the email registered for that student in the selected tenant. The server returns a generic OTP request message, issues six-digit purpose-HMAC hashed codes with five-minute expiration, bounds attempts with persistent `AuthThrottle` records, consumes each code once, and exchanges it for a revocable 10-minute random token stored by digest in namespaced `VerificationToken` records. The token maps to exactly one database student/tenant/academic period. The student response contains only `cleared`/`hold` and period metadata; it suppresses names, IDs, arrears, balances, and QR paths that embed student IDs. `Cache-Control: no-store` is applied.

**This is proposed code, not certified for live Production.** It must pass runtime tests using synthetic enrolled accounts on an isolated Neon clone: correct/wrong/expired/reused OTP; admission limits; account and source throttling; student A vs student B; officer/global credential separation; tenant and academic period boundary; revocation; historical penalties, voids and arrears. Review the AuthThrottle/VerificationToken reuse and SMTP delivery before deployment, and confirm the exact app/Server version pair.

An aggregate-only Production readiness query found 104 student records, 94 with a plausible email and **10 without registered email**. The latter need supervised tenant-admin identity verification and registered-email backfill through authorized web workflows; there is deliberately **no** bypass using an unverified student number.

**Separate web privacy concern:** the existing public web clearance page still permits lookup by an ID or email. That is an existing public disclosure policy and is not silently changed by this mobile PR. Review it independently for enumeration, status sensitivity and rate limiting before claiming end-to-end private clearance.

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
