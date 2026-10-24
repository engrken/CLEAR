# CLEAR Android v1.2.2 — Operational access and expansion gates

**Proposal status: DRAFT; not deployed or submitted to Google Play.** Owner requested that v1.2.2 evolve from a read-only mobile viewer to a role-scoped operational app and expose additional modules to all categories of users. This patch **does not** grant all users all privileges and **does not** enable financial posting without audited server implementations.

## User-by-user delivery matrix

| User | v1.2.2 access prepared | Native transaction status | Additional first-party modules |
| --- | --- | --- | --- |
| Student / public user | Department discovery, registered-email OTP, private clearance status, guided onboarding | Clearance OTP/session mutations already supported. Financial proof API currently returns HTTP 503, so no upload until canonical service exists. | Student/department web portal link, opened without passing student ID, OTP or app token |
| Officer / treasurer / auditor / other assigned role | Searchable Modules directory using **server-assigned** `allowedTabs`; overview, roster and proof review where granted | Mobile payment OR posting and verification are **not yet enabled**; corresponding backend mutation endpoints are absent | Secure web links to existing department module pages, each requiring separate web sign-in and current web role permission |
| Tenant administrator | Own-tenant operational setup via secure web portal, existing native tenant status | No new native department-settings POST API in this patch | Setup, users, collections, reports etc only if the user's saved grants allow them |
| Global Superadmin | Cross-tenant overview and management; native provisioning and tenant lifecycle form (already using shared web core) staged behind independent client + server opt-ins | **Optional** native tenant provision/status/tier/group changes only after manual Production authorization. Financial writes across tenants still denied. | Existing audited global provisioning portal at `/dashboard/provisions` via new web session |

## Explicit opt-in controls and defense-in-depth

- **Client build:** `EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS=true` displays native Global Superadmin tenant-management operations and permits the two provision/manage mobile API calls. Never set this for the legacy `live-readonly-internal` build.
- **Production server:** `MOBILE_TENANT_OPERATIONS_ENABLED=true` **and** `VERCEL_ENV=production` **and** `VERCEL_GIT_COMMIT_REF=main` are jointly required for **POST /api/mobile/global/provisions** and **POST /api/mobile/global/provisions/manage**. Default is DENY. Isolated integration Preview rules are unchanged.
- **Independent route authorization:** Both endpoints call `requireGlobalMobileAdmin` and `requireAndroidProvisioningPreview` (legacy function name) and invoke the canonical audited web provisioning core. All mutations require confirmation phrases; unauthenticated or department-officer tokens must fail.
- **No global write bypass:** `MOBILE_BUSINESS_WRITES_ENABLED=false` and `PAYMENT_WRITES_ENABLED=false` remain in force. Client paths to proofs, payments and remittance verification continue to fail closed; server method/path allowlist rejects them on Production even when the tenant operation capability is enabled.
- **Fresh web authentication:** Module links open only hardcoded first-party `https://clearsys.vercel.app` pages. No app bearer token, OTP, email or student information is passed in the URL. Web server roles, tenant scope and any stronger web controls remain authoritative.
- **Feature rollback:** Remove `MOBILE_TENANT_OPERATIONS_ENABLED` on Vercel to instantly restore server-side denial without replacing the Android app. Remove the client opt-in from the next AAB to hide native tenant actions. Disabling server authorization always takes precedence.

## Phased activation before v1.2.2 Production

1. **Static CI:** `npm run test:mobile-roles`; `npm run test:finance`; root `npx tsc --noEmit`, mobile `npm run typecheck`; existing release signing/build checks. All tests must pass after branch integration.
2. **Preview mutation rehearsal:** With approved test Neon data, verify **only** the two existing global tenant operations with unique disposable tenants, confirmation phrases and before/after audit trails. Verify non-global JWTs, expired/revoked OTP sessions, wrong tenants, malformed tier/group/status, and unknown methods return 401/403/400 without writes.
3. **Production preflight:** Create verified Neon snapshot; check web transactions and OR sequence baseline; separately verify Vercel environment DB binding, current production core, audit log and rollback/flag access.
4. **Server release:** Deploy code with `MOBILE_TENANT_OPERATIONS_ENABLED` still unset/false. Check all existing mobile data and the JIECEP Activity regression. Enable server capability **only after** reviewed owner approval and security sign-off.
5. **Mobile release:** Build signed Play AAB from the final merged commit, setting the client flag only for the approved production profile; verify `versionCode` against EAS remote and Play, API target, package/certificate, Android app branding and Play acceptance. Test internal track before Production draft.
6. **Functional UAT:** Student OTP/status, officer role grants, cash-handling web handoff, remittance review, direct-link denial, tenant admin own-only, global cross-tenant read and provision/manage with audit, all negative authorization cases. Confirm website prompts for separate sign-in and returns 403 for unauthorized tabs.
7. **Publish:** Stage rollout after Play Console owner authorizes it. No CI job or GitHub merge publishes the app automatically.

## GitHub issue #65 — scoped mobile search (v1.2.2 incremental)
- Authorized officer home Activity and Global Superadmin tenant Activity now have **instant client-side filtering** on the already-loaded, API-authorized bounded batch by student name, OR/reference, receipt base number, description or status. Filter chips distinguish all entries, receipts and voided receipts (voided **collections** only).
- Global students and remittance sections filter their already-loaded tenant-scoped records without sending credentials, names or queries to third-party services.
- A mobile officer sees **full Receipt History** and **Void Center** via dedicated fixed, first-party HTTPS web handoffs only when their current server-issued allowed tabs include `tab-payment` or `tab-void`, respectively. The independent web login and permission checks are mandatory.
- **Explicit limitation:** on-device search is *not* full history. The ledger API returns only recent active-term rows (bounded to 100 by default); a missing match is not proof that an older OR/VOID does not exist. Full audit remains on web. No financial write APIs or SQL queries were added.
- Still pending under #65: independent real-device search UAT and a dedicated complete native historical-OR/Void audit if desired; do not close the tracking issue solely because source CI passed.

## Explicitly excluded from this patch

- Native official receipts, payment posting, OR sequence allocation, payment void/reversal, remittance approvals/invalidations, proof uploads and financial editing. Server APIs must reuse the *canonical audited transaction engine* with transaction isolation, idempotency, permissions, ledger reconciliation, exact centavo arithmetic, audit trails and test Neon before activation.
- Broadening Global Superadmin tokens into tenant-officer financial permissions.
- Unauthenticated student financial views or leaking account data through external web links.
- Web/mobile feature drift: any new web module requires a tracked mobile counterpart or secure fallback under the established parity policy.

**Outcome at this draft stage:** operational **web modules** are discoverable for every correctly assigned officer; student and tenant-admin web entry points are provided; optional native Global Superadmin tenant management is coded but **fail-closed until separately enabled**. This is **not** a claim that all native transaction modules have been delivered.
