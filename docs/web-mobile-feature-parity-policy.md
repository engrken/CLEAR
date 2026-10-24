# CLEAR standing web ↔ Android feature parity policy

**Effective 2026-10-23 — owner directive.** Tracking issue: [#64](https://github.com/engrken/CLEAR/issues/64).

## Single-product policy

Every approved **web** patch (features, defect fixes, security, financial policy, UX, privacy, search, onboarding, and permissions) must be assessed for **Android** and implemented in the mobile source wherever applicable. The same rule applies in reverse. Two separate client interfaces must not silently develop conflicting financial logic, role grants, student inquiry behavior, or terminology.

This is **functional parity**, not permission to expose restricted information or unlock mobile financial transactions. The server remains authoritative, with tenant, academic-period and role-based access on every request. Mobile business writes remain disabled until separately reviewed and authorized.

## Required PR checklist

1. Describe the changed workflow, impacted users/roles, and affected academic period/tenant/data flows.
2. Identify web component/routes, mobile component/routes, and shared API/financial-policy implementation. Mark each **implemented / existing and verified / pending / platform-specific exception**.
3. When a web change has a mobile equivalent, include the corresponding Android implementation in a linked PR **within the same patch workstream**, or link a blocking parity issue with explicit acceptance conditions. Do not label the whole feature **complete across platforms** while the mobile code or device QA is outstanding.
4. Cover both surfaces with automated checks, role/tenant isolation, student OTP privacy, accurate enrollment/clearance semantics and financial/receipt invariants. Validate on an approved isolated test database; do not disclose or change live records through tests.
5. Document mobile release notes and device QA, including the public Play build version versus source state.
6. Genuine platform-only operations (Play signing, printer/browser-native output, device hardware integrations) may differ; record why and provide appropriate alternative UX. Security exclusions such as mobile void/payment posting are not to be bypassed for parity.

## Source versus release cadence

- **Web:** reviewed/merged patches deploy separately through Vercel; Production must be verified before claiming live behavior.
- **Android:** approved mobile source counterparts accumulate in the **next major Android release** tracked by [#61](https://github.com/engrken/CLEAR/issues/61); do not ship a new Play binary for every small web patch. Published Android **v1.2.0** is the confirmed baseline until a later authorized, QA-tested and properly signed Play release.
- A GitHub merge and Vercel READY deployment do **not** deliver new code to an existing Google Play installation. Rupert's confirmed signing provenance must be preserved.

## Current next-patch parity matrix

| Feature | Web source | Android source | Release / acceptance |
| --- | --- | --- | --- |
| First-time officer onboarding and presence | Merged in PR #60 | Implemented in mobile source in PR #60 | Web live; test officer roles/device; Android Play v1.2.0 not updated |
| First-time student clearance tutorial | Draft [#62](https://github.com/engrken/CLEAR/pull/62) | Mobile counterpart staged alongside this policy in a separate draft | Privacy-first, replayable, student-only, no student data persisted |
| Reactive student roster search | Draft [#63](https://github.com/engrken/CLEAR/pull/63) | Already reactive in `mobile/src/app/(officer)/students.tsx`, subject to device QA | Search only authorized returned roster; no extra student email exposure |
| Reactive tenant search | Existing tenant client interface | Already reactive in `mobile/src/app/global/provisions/index.tsx` | Global read-only, independent global session |
| Reactive receipt history search | Draft [#63](https://github.com/engrken/CLEAR/pull/63) | Dedicated receipt history search UI not yet available in read-only mobile | Track mobile read-only visibility; do not enable receipt creation or resend via mobile |
| Reactive Void Center search | Draft [#63](https://github.com/engrken/CLEAR/pull/63) | Void Center remains intentionally web-only in mobile source | Requires separately authorized **read-only lookup** design; no mobile VOID action |

### Mandatory regression checks before merge

- Web: `npm run test:finance`, `npm run test:mobile-roles`, `npx tsc --noEmit`, `npm run build`, plus specific patch tests.
- Android: `cd mobile && npm run typecheck`, role/OTP tests, then on-device QA in an approved build.
- Validate rapid search/paste/erase, empty state and filters, unauthenticated denial, cross-tenant attempts, and shared-device student-data expiry.
- Do not run staging tests against actual Production records or an out-of-sync preview database.

**Ownership:** every reviewer and future patch author must explicitly address both platforms. See [standing policy #64](https://github.com/engrken/CLEAR/issues/64) and [Android release queue #61](https://github.com/engrken/CLEAR/issues/61).
