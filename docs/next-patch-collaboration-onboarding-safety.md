# CLEAR next patch — collaboration, confirmation and onboarding

Status: **Draft PR #60; not deployed or merged.** This scope is layered on the enrollment-fee, web/mobile Overview, privacy and email-rotation fixes. PR #59 remains a separate signing-security dependency.

## Safe release sequence

1. Verify Prisma schema, generate the client and rehearse `20261023100000_officer_presence_onboarding` against an isolated Neon recovery/preview branch. It creates `OfficerPagePresence` (officer FK, tenant/page/last-seen index) and nullable `TenantUser.onboardingSignature`. Do **not** run migration directly against Production without an approved backup and migration plan.
2. Confirm the active tenant authorization helpers and mobile read-only allowlist. Presence/onboarding allow only session metadata changes; financial posting and tenant provisioning stay prohibited on Android.
3. Re-run web build, type-check, Financial checks, `npm run test:mobile-roles`, Android `npm run typecheck`, data privacy/security tests, and release preflight in a properly configured CI runner. **Any failing required check blocks merge.**
4. Test with two distinct officers in the **same** tenant, page, AY and term: initials appear within ~30 seconds, web hover/mobile tap exposes names, no student emails are returned, self is not counted. Other pages/terms/tenants never leak. Backgrounding/closes/expired tokens clear presence; after ~80s inactivity it disappears even if delete fails. This is a presence indicator, **not** live co-editing, locking or a financial approval state.
5. Test first login for treasurer, auditor, viewer, admin and custom-grant officer: only assigned modules appear. User can Back, Next, Skip, Finish, replay; completion persists across web/mobile and reappears if role or permission signature changes. The data privacy notice must appear first. Global and tenant superadmin roles are exempt.
6. In a preview tenant with **synthetic** records, exercise confirm/cancel paths for payment receipt, remittance verification, advance, liquidation, penalty, roster status/update, fee setup creation/removal, users/status, fund allocation, arrears, payment-proof submission, report settings and term rollover. Cancel must perform **zero** business writes; confirm must invoke the existing audited server action with its idempotency, authority and period checks still enforced.
7. Test tablet/mobile viewports, high contrast, accessible keyboard/touch navigation, online/offline transitions, loss of permissions during a session, and no cross-tenant presence. Keep the Play Store published APK unchanged until the signed AAB is validated.

## Design and security rules

- Presence heartbeat every 30 seconds with 80-second activity TTL; query never returns other pages, unauthorized users or email addresses.
- Every server request checks the tenant, active officer, and required module. Client-supplied names, roles, organizations and counts are ignored.
- Onboarding is **server-persisted per officer and role/permission signature**, not a non-authoritative localStorage grant. Reset when a role/tabs change; privacy consent remains separate.
- Confirmation text describes the subject, amount/period where applicable and what the commit will do. Cancel is emphasized by default. The backend remains the source of truth and must still reject double payments, overpayment, closed periods, and unauthorized mutations.
- Mobile remains a read-only business viewer. Allowed OTP, onboarding, and presence metadata requests are *not* permission for new financial functionality.
- Existing web-officer direct `updateMyEmail` remains a release-review item: it should be aligned with dual-address OTP before claiming system-wide email-change security parity.
- Confirmations added in this patch cover identified high-impact workflows. A **complete mutation inventory** and client/server runtime verification are still required before asserting that *all* buttons/flows have equivalent confirmation UX.

## Rollout and rollback

Ship database migration before showing presence/onboarding UI. On API failure, UI fails closed: hides presence or does not auto-open walkthrough instead of disclosing stale data. Roll back application code first and retain the harmless new metadata schema until no deployed binary uses it; avoid destructive schema rollback. No receipts, OR sequences, student balances or ledger rows should be changed during testing.
