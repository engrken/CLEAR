# Student clearance explanations — OTP-only rollout (27 October 2026)

## Objective
Reduce repeated officer inquiries by explaining **why this student's own clearance is not yet ready for signing** after the existing registered-email student-ID + six-digit OTP flow. Clearance eligibility is **not** recalculated or loosened by this presentation feature.

## Student-visible behavior
- **CLEARED:** unchanged live approval / first-party encrypted QR when the active term is open; no hold rows.
- **CLEARANCE ON HOLD:** read-only list of pending mandatory package balance, assessed fees/collectibles, recorded unpaid fines, historical debts (with originating term/year), and unresolved cash advance liquidation. Amounts show exact PHP centavos for payable obligations.
- **NOT ENROLLED THIS TERM:** explicit enrollment-not-confirmed reason and any existing standalone or previous-term dues, without generating an automatic mandatory-package fee.
- **Cash advance:** an unresolved liquidation is a hold reason, **not a collectible payable balance**. Do not display the approved amount as money to pay.
- Each reason has a short practical next step (department administrator or authorized treasury/clearance officer). If the student has already paid, ask for a record correction or confirmation; no posting, account change, payment shortcut or false “pay now” action.

The list is a limited explanation of **existing** live records, not a transaction ledger or official receipt. No OR numbers, transaction identifiers, payment channel references, raw penalty notes, private staff comments or student names/IDs are introduced in the explanation payload.

## Authorization and privacy
1. Only the student branch of `GET /api/mobile/orgs/:org/clearance` receives `holdReasons`, after `requireStudentClearanceSession` revalidates the token, selected tenant, academic period, roster ownership, and `result.student.id === student.id`.
2. An arbitrary `?q=...` requires an authorized tenant officer with `tab-clearance`. It cannot disclose `holdReasons` without that student's OTP; officer existing `unpaidItems` access is unchanged.
3. Signed QR verification and public certificate view remain **status-only**. Never attach explanations or financial data to QR payload, a public URL, notices, analytics or logging.
4. No-store HTTP responses and browser/mobile memory-only sessions remain in place. Web clears result and token after two minutes or tab hide. Native UI changes are deferred to a separate stacked draft PR, which will clear on background or timeout. No local/private persistence.
5. UI privacy notices and onboarding explain the new limited verified disclosure.
6. Strict integer centavo conversion for displayed payable amounts; do not round arbitrary subcent data or “fix” stored source data.

## Rollout and acceptance
No Prisma schema change, migration, backfill, receipt/penalty mutation, or Android binary. The API is additive: the published Android clients ignore `holdReasons`. Native rendering, native privacy notice updates and app background clearing are being prepared **in a separate stacked PR** for the next signed and approved Play release. Do not merge/deploy to production until complete CI, real tenant/role negative UAT and explicit owner approval.

### Verification checklist
- [ ] Node helper tests for amount fidelity, unsafe input and advance-vs-payable distinction.
- [ ] CircleCI web, mobile, financial-security and Vercel Preview (Next build) green.
- [ ] Real authorized staging student: cleared, hold with multiple item types, unenrolled, active/historical penalties and collectibles, voided receipt restoring a hold.
- [ ] Real authenticated student OTP valid/expired/replayed/cross-tenant/cross-term/non-owner sessions. All unauthenticated detail queries denied; no student-data enumeration.
- [ ] Officers retain original authorized lookup; no `holdReasons` in signed QR verifier or public pages.
- [ ] Web private result disappears when tab hidden or after two minutes; no browser history/query, cache, logs, print or analytics exposure.
- [ ] Follow-up Android PR: internal-test device shows student-only reasons and background/timeout clearing; no binary shipped in this web patch.
- [ ] Confirm zero writes to financial records and no changes to eligibility logic, OR sequence, fees, money values or historical debt recovery.
