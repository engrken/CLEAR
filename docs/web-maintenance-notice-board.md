# P3 Web maintenance controls and Notice Board — implementation review (#100)

## Defaults and safety
- **Maintenance is OFF by default.** Absent policy rows evaluate to NORMAL; migration creates three new tables but inserts no active policy or notice and changes no financial records.
- **Do not merge before applying/test-rehearsing the new Prisma migration in a controlled environment.** The Next.js Proxy fails closed with generic 503 if policy state cannot be read, including missing schema and DB outages. A deploy-before-migrate sequence would interrupt the app.
- The existing emergency financial cutover environment lock `CLEAR_MAINTENANCE_MODE=locked`, the original `app/maintenance/page.tsx` content, and `engineering.localhost` tenant rewrite are **preserved**. The historical cutover switch takes precedence.
- Active GLOBAL policy takes precedence over tenant-specific policy. Expired policy automatically resolves to NORMAL without a cron task. Maintenance duration must be between 1 minute and seven days.
- P3 is database-backed and shared by web and Android API requests. Current Play Android v1.2.4 is not updated with new banners. It receives server-side restrictions but not a native maintenance UI until the single future consolidated Android release (#61).

## Protected operator controls
- Global Administrator OTP and active-identity checks via `requireSuperAdmin`. Only the maintenance control actions explicitly call the recovery-capable guard; other Global Administrator and tenant financial actions remain blocked when maintenance is active, even under forged cross-page Server Action POSTs.
- Control page: `/dashboard/provisions/maintenance`. Available as a minimal nonprivate login prompt during FULL mode; global OTP endpoints remain available to authorized operators.
- Policy changes require an exact typed confirmation, reason for non-NORMAL mode, PHT expiry and transactionally appended MaintenanceAudit records.
- Changes use a single PostgreSQL transaction; no financial mutation or recipient/user information enters the public status API.
- Public status: `/api/maintenance/status?tenant=<slug>` and `/api/maintenance/notices?tenant=<slug>` (no-store); only safe mode and public notice fields are returned.
- READ_ONLY denies mutating requests and Server Actions. FULL redirects private UI requests to the existing generic maintenance page or returns 503 JSON on API calls. GET-only financial endpoints remain subject to their existing RBAC and tenant checks.
- Global operator auth via `/api/auth` is a maintenance recovery exception, not permission to write financial transactions.

## Scheduled Notice Board
- Independent draft and published (SCHEDULED) notices; auto-display ACTIVE within their published start/end window using server UTC and browser Asia/Manila formatting.
- Publishing or rescheduling does **not** activate the maintenance mode. No auto-activation scheduler is provided.
- Global or tenant-scoped safe announcements, configurable start/end and revision-aware dismissible upcoming notices. Active notices are not dismissible.
- Web banners poll every 45 seconds, refetch on tab visibility and show on landing pages and signed-in screens. Native Android banners are deferred to the consolidated store release.
- Global Administrator forms support draft creation, publish, reschedule and cancel, with append-only audit events.

## QA required before production
1. All CircleCI web, mobile, financial-security checks green including existing cutover/proxy tests; Vercel preview READY.
2. Isolated local PostgreSQL migration deploy/status/schema diff and protected HTTP tests for NORMAL, tenant READ_ONLY, global FULL, precedence, expiry, OTP recovery, notice scoping and no financial writes.
3. Authenticated manual operator UAT on protected Preview: verify denial for tenant officers, non-admins and forged action requests, exact PHT expiry, public notice privacy, and successful FULL→NORMAL recovery.
4. Measure P2 performance regression from request-level maintenance lookup across warm/cold paths and improve if p95 degrades.
5. Rehearse recovery with backup/snapshot and verify a safe migration-before-code rollout. Production must start with zero active policy records, and production activation requires separate operator decision.

## Limitations requiring further review
- P3's request-level policy enforcement does not stop a transaction already committed before a maintenance switch and cannot replace Prisma transaction/idempotency controls.
- Database policy availability is required while proxy is active; status verification failures intentionally produce 503 to avoid accidental financial writes.
- Global administrative maintenance recovery must remain protected even if caller supplies a forged request path/action ID; review each privileged mutation guard and test direct Server Action POSTs.
- No scheduled automatic activation and no background mobile push were implemented; they require separate opt-in and safe delivery semantics.