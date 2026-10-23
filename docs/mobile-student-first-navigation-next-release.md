# CLEAR Android GUI refinement — next major release

**Status:** staged source patch for review; **NOT shipped to Play**. October 23, 2026.

## User experience goals

- **Students:** Understand a single first action: choose the organization and check clearance. A short, plain-language three-step guide explains department selection, registered-email verification and private status results. No false promise of QR/certificate access in the student status-only flow. Search published organizations locally while typing; **never search student identities without OTP**.
- **Officers:** Keep Home, Students, Review and Modules as simple tab destinations when authorized. Hide the Collect tab while mobile payment posting is disabled; deep-link route also remains protected. Rename Verify → Review to make the read-only restriction explicit.
- **Officers and tenant admins with many modules:** Search **only role-granted modules**, grouped into Students & clearance / Payments & finance / Reports & administration. Default to available Android readers, with an optional all-assigned view clearly distinguishing paused and web-only modules. Modules are presentation-only metadata: all actual access remains server-authorized, and web-only functions never become enabled mobile mutations.
- **Global superadmins:** Remove navigation calls to disabled provisioning. Keep independent global sign-in, authorized per-tenant readers and read-only status labels.
- **Everyone:** Preserve Bright Campus design tokens, 44+pt touch targets, clear captions, read-only disclosures, accessible search labels and term/organization context.

## Real-world UAT scenarios

1. Student with no session: landing → choose org (type search, clear it, no matches) → private clearance → code request, verify, read status; no display of QR/financial amount or another student's records.
2. Student tries GCash/Maya proof flow: sees accurate unavailable guidance; cannot open disabled upload route from normal UI. No financial POST/DELETE is enabled.
3. Officer with `tab-students` only: Home/Students/Modules tabs; only granted roster modules present. Deep links to Collect or Verify fail.
4. Officer with `tab-remittances` only: Home/Review/Modules tabs; review detail is read-only, no confirmation/OR posting.
5. Officer with `tab-payment` but not `tab-students`: read-only roster remains available via existing role policy; Collect tab is hidden; no payment transaction.
6. Admin with all tab grants: find a module by text, select All assigned, inspect web-only and unavailable labels, open only explicitly available readers, navigate back. Account/help links and first-time guide replay work.
7. Global superadmin: tenant directory + cross-tenant read-only overview, no broken Provision button.
8. Check narrow Android display, large font, TalkBack labels, safe area, long organization names, offline/loading/error states, search backspacing and permission refresh.

## Verification and release policy

- `npm run test:mobile-roles` includes `tests/mobile-navigation-refinement.test.mjs`.
- `npx tsc --noEmit` and `cd mobile && npm run typecheck` must pass.
- Real device QA and Android App Bundle signing are **not** performed by source/CI tests. Follow the owner-approved [next major Android release #61](https://github.com/engrken/CLEAR/issues/61), preserving Rupert's verified Play signing identity.
- **Web–mobile parity (#64):** web already has separate public student inquiry and role-gated departmental modules. This patch adapts Android navigation without changing shared APIs/permissions/financial rules. Record any further web-facing need as its own reviewable patch, not silent drift.
- Related draft web student guide [#62](https://github.com/engrken/CLEAR/pull/62), reactive web search [#63](https://github.com/engrken/CLEAR/pull/63) and mobile counterpart [#66](https://github.com/engrken/CLEAR/pull/66).
