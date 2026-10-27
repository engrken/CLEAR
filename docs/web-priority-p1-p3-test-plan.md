# CLEAR Web priority plan and acceptance matrix — 27 October 2026

**Policy:** P1 financial integrity -> P2 receipt-history performance -> P3 centralized maintenance & scheduled Notice Board. Each is an independently reviewable web/backend PR. Production database and receipt ledgers are not test fixtures; use disposable PostgreSQL/Neon **test branches**. Mobile APK/AAB remains deferred to the one consolidated Android release, issue #61.

## Release gates shared by all three priorities
- [ ] Protected main's required **CircleCI Web**, **CircleCI Mobile**, **CircleCI Financial-Security** checks are green on the exact reviewed commit, and Vercel Preview succeeds. Recognize separate GitHub Actions pre-job failures as unavailable, not passing.
- [ ] Prisma migrations (if any) apply from an empty isolated DB, report zero drift and preserve production schema/backup rollback procedure.
- [ ] Authenticated route tests include missing session, expired/revoked session, wrong tenant, wrong tab, deactivated accounts, inactive tenant, Global Administrator positive and impersonation negatives as applicable.
- [ ] Financial before/after snapshots preserve Collection counts, receipt sequence, ORs, Penalty balances, Advance/Liquidation states, Remittances, Void audits and Fund balances; no unapproved writes.
- [ ] All user-visible times use **Asia/Manila**, while server state and database timestamps are UTC.
- [ ] No passwords, OTPs, session/bearer tokens, student PII, OR numbers, monetary amounts or bank information in metrics/maintenance public responses.
- [ ] Deploy only approved, isolated changes with rollback plan; perform post-deploy read-only smoke and Vercel runtime-error review.
- [ ] Keep Android UI changes for the single future signed Play AAB. Web/server compatibility must be tested against published Android v1.2.4 API contracts.

## P1 — Web/API financial ledger exact-centavo safety (PR #101; #99)
| ID | Test | Expected result | Type |
|---|---|---|---|
| P1-01 | Money parser for all 5 sources: Collection, Online Remittance, Penalty, Cash Advance, Cashier Remittance | Integer centavos exactly; reject malformed, null-required and subcent amounts | Unit |
| P1-02 | Legacy duration `4.4333` hours at ₱50/hour, 266 minutes | ₱221.67 reconstructed with existing nearest-cent policy; no currency floor or double rounding | Unit/integration |
| P1-03 | Legacy flat LATE_FEE with no original assessment | Preserve exact outstanding balance; omit unknown assessed amount, never fake zero | Unit/integration |
| P1-04 | Malformed duration, nonfinite value, unsafe precision | HTTP 422 `financial_data_review`, safe message; no private row details, partial success or mutation | Isolated HTTP |
| P1-05 | Ledger GET with missing/expired/off-tenant/unauthorized officer session and Global Administrator token | Expected 401/403, active session and policy checked each request | Isolated HTTP |
| P1-06 | Valid Global Administrator -> JIECEP Activity and officer current-term Overview | All visible amounts/penalty are exact; no new errors on the approved deployed version | Authenticated read-only smoke |
| P1-07 | Collection, penalty, settlement, void and audit counts/hashes before and after malformed GET | Unchanged; no database writes, OR reissue or financial aggregate drift | Isolated audit |
| P1-08 | Published Android v1.2.4 response shape | Existing `LedgerEntry[]` unchanged on `/ledger` | Contract |
| P1-09 | Final merge/rollback readiness | CI green, approval documented, deployment observed, logs checked, rollback recipe recorded | Release |

## P2 — Receipt History correctness and performance (#70, draft PR #108)
| ID | Test | Expected result | Type |
|---|---|---|---|
| P2-01 | Search by exact base OR or any `-P02/-P03` allocation | Same **complete** issued receipt group and true total; no partial OR | Unit/HTTP |
| P2-02 | Old repeated-base OR vs new `-Pnn` lines, cross-year reused OR | Correct group count; reused OR across periods flagged inconsistent, not combined | Unit |
| P2-03 | Voided, mixed-valid, malformed money, subcent historical rows | Proper Voided/Inconsistent statuses; never fabricate valid totals | Unit |
| P2-04 | All search/filter combinations: name/ID/OR, term/AY, status/category, date range, 10/25/50/100 pages | Server-side authorized result count and page boundaries correct; no missing/duplicate groups | Isolated HTTP |
| P2-05 | 1,000+ synthetic ORs, multi-line packages, tied timestamps | Stable deterministic grouping and pagination; no cross-tenant leak | Synthetic stress |
| P2-06 | Cold/warm `Receipt History` exact OR, narrow query, broad query, all terms | Collect ≥30 warm samples per scenario in isolated representative DB, report median/p95 and query count, compare **same fixture** to baseline; do not claim measured performance until run | Benchmark |
| P2-07 | Metrics disabled by default; when enabled only dbMs/groupingMs and aggregate counts | No tenant/student identifiers, ORs, emails, search terms, tokens or amounts in logs | Source/privacy |
| P2-08 | Wrong tenant, missing tab-payment, anonymous, revoked/deactivated officer | Denied independently of search filters/OR | Security |
| P2-09 | Before/after Collection and OR/finance audit | No money/receipt history modifications; digital receipt resend separately authorized and idempotent | Finance regression |

## P3 — Maintenance control and Notice Board (#100)
**Stage 1 only:** a public status API reports the EXISTING emergency env lock truthfully; a pure policy model tests precedence, UTC activation/expiry and server-request method decisions. This **does not yet enable DB toggles, announcements, automatic scheduling or production locks.** Full P3 requires separately reviewed migrations, global admin controls, shared web/mobile enforcement, and recovery rehearsals.

| ID | Test | Expected result | Type |
|---|---|---|---|
| P3-01 | No database policy, env unset | **Normal** on web/API/mobile; current Production unaffected | Unit/HTTP |
| P3-02 | Existing `CLEAR_MAINTENANCE_MODE=locked` | Full 503 for private GET/POST; branded `/maintenance` and safe `GET /api/maintenance/status` reachable; no cache | Isolated HTTP |
| P3-03 | Normal -> read-only -> full -> normal | Every protected server route and *all* financial POST/PATCH/DELETE/Next Server Actions denied during maintenance even by direct URL; no client bypass | Full integration |
| P3-04 | Global policy vs tenant-specific policy, wrong-tenant tokens | Global supersedes tenant; one-tenant notice/status never leaks to another | Unit/integration |
| P3-05 | Expired, future, cancelled, updated and disabled policies | No lock before effective UTC start; clean automatic expiry; notice publication alone never activates restrictions | Unit/integration |
| P3-06 | Global Administrator control auth, forged role, tenant admin/officer/student, CSRF and session version | Only valid Global Administrator may change a maintenance policy with explicit confirmation; audit who/when/reason old/new | Security |
| P3-07 | Maintenance Notice Board draft/schedule/publish/reschedule/cancel; revision-based dismissal | Visibility by audience/scope; updated notices redisplay; inaccessible items absent; no auto-lock from bulletin alone | Full integration |
| P3-08 | UTC schedule crossing PHT midnight and DST-independent Asia/Manila conversion | Web UI says PHT and displays correct local times; trusted server time decides activation | Timezone |
| P3-09 | Public status privacy, cache, Retry-After, polling/recheck active session | No PII/tokens, no stale private cache, correct 503; updates observed without re-login; no unbounded client polling | HTTP/UI |
| P3-10 | Active student clearance OTP, officer OTP, tenant Admin, Global Admin, background tasks and receipt resend | Explicit documented mode behavior; no acceptance of partial/mid-flight financial operations or false success | Security/E2E |
| P3-11 | Policy database outage, missed cron, admin recovery, cancellation/extension | No silent fail-open financial mutations; emergency env lock and audited recovery still available | Disaster rehearsal |
| P3-12 | Android startup, foreground resume, sign-in and active session after web policy changes | Same server-authored mode and notices; only in future consolidated Play release after Internal Testing | Cross-platform UAT |

## Execution order
1. P1 #101: required CircleCI green and owner Production baseline ledger smoke accepted. Perform controlled final review; **no automatic merge/deploy without approval and post-deploy plan**.
2. P2 #108: isolated source/group tests, then representative staging receipt benchmarks. Preserve broad-history semantics until the group-aware scalable query is independently proven.
3. P3 #100: stage 1 tests first; implement audited database-backed policy and server enforcement in a separate stage before activating or presenting controls. Then web Notice Board and eventual Android UI.
