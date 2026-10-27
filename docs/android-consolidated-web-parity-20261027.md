# CLEAR Android next consolidated update — integration manifest
27 October 2026. Source integration follows the latest verified Web Production commit `27fc4158b5904cbb025a3e2c429a410d8113ad1c`.

## Included native parity
| Web release / requirement | Native implementation | Boundary |
|---|---|---|
| #112 verified student clearance explanations | OTP-only hold reasons, precise payable centavos, cash-advance liquidation action, 2-minute/background removal | Requires student's own validated tenant/term/student session; no public identity, receipt or officer notes |
| #108 complete grouped receipt history | Authorized reactive Receipt/Void search displays full issued-OR amount and allocation count; complete history opens independently authenticated Web page | Search is tenant/role-scoped and GET only; native financial module Collections displays individual allocation lines accurately |
| #101 exact-centavo ledger | Tenant scoped financial review and complete cursor-paginated Activity; rejects malformed precision | No fabricated rounding; financial writes blocked |
| #110 maintenance controller/Notice Board | Same canonical public maintenance API on app launch, signed-in session, every 45 s and foreground, tenant scoped, revision-aware dismissal and PHT dates | Server proxy/actions remain authoritative; client cannot turn maintenance ON/OFF |
| Read-only roles and permissions | Officer, Administrator tenant portal, Global Administrator/tenant overview, modules filtered by server-tab grants | Global Administrator is not impersonated as an officer; no broad native tenant mutation |
| Web privacy/onboarding/reactive searches | Matching student privacy notice and self-service guide, bounded reactive receipt search, native landing and privacy acknowledgement | No OTP, bearer, student or receipt identifiers sent to telemetry |
| Correct Android launcher | Owner-approved adaptive and standard vNext assets staged from #96 | Fresh prebuild and on-device icon test required before signing |

## Deliberately web-only / not authorized in Play app
* Audit-grade posting, OR issuing, voiding, settlement, financial transfers, liquidations, receipt resend, maintenance scheduling, Global Administrator management/security audit and privileges remain on the secure Web with independent authentication and permission checks.
* Vercel Speed Insights (#111) is Web telemetry; it is **not** bundled into native Expo nor used to transmit student query information.
* #102 SaaS billing, InstaPay QR payments, automatic subscription renewals and public tenant registration are **planned**, not currently verified Web Production features; do not add forbidden off-Play subscription purchase links.
* Performance engineering #70 long-range scalable Web group-aware SQL query/benchmark is not complete; do not claim native or Web p95 improvement.

## Release engineering gates
1. Resolve *all* CircleCI Web, Mobile (Expo TypeScript+lint), Financial Security and Vercel Preview status checks. In particular legacy stacked draft PRs #96, #98, #107, #113 are **not merged**. Review integration itself; no feature claims based on isolated PR tests alone.
2. Build a fresh native Android project, verify image, adaptive launcher and app manifest, and check APK/AAB package `com.rupertbulquerin.clear`, target SDK and signatures. **The integration presently retains 1.2.4/code 14 only as the historical source/icon baseline, NOT the next Play version**. Before creating/uploading any AAB, verify all Play tracks to choose a genuinely unused code and update/review *all* hard-coded historical v1.2.4 scripts and tests.
3. Google Play Upload signing key stays with owner. Never commit key, Expo credentials or bank details. Do not sign or upload until owner explicitly approves candidate, certificate, version code and release notes.
4. Run authorized real-device internal testing: cleared QR camera verification; OTP expired/replay/cross-tenant and hold reasons incl exact centavos; background/timer private cleanup; authorized officer tab and inactive tenant denials; Finance Review Penalties/Advances/Liquidations/Collections; complete Activity pages with 500+ synthetic entries/void empty states; global tenant/role access; package receipt suffix search; maintenance normal/read-only/full/upcoming/revised/cancelled for correct tenant, including app foreground; privacy consent/scrollbar, login, navigation and icon.
5. Keep `PAYMENT_WRITES_ENABLED=false`, `MOBILE_BUSINESS_WRITES_ENABLED=false`, and release `TENANT_OPERATIONS_ENABLED=false`. Test endpoint denial from direct HTTP, not merely hidden buttons.
6. New paginated finance endpoints need an approved server-only merge/deploy with backwards-compatible legacy array API and isolated negative HTTP tests before final Android Play candidate can use them.
7. After internal UAT/feedback, owner approves Play Production promotion separately. Web production data and current Play production binary remain unchanged by this integration PR.
