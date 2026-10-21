# CLEAR Android PR #41 — Role and permissions parity

## Authority and isolation

- **Global Superadmin** authenticates via `/api/mobile/global/auth/*` and a
  distinct `GlobalMobileSession`, revalidated by `verifyGlobalAdminSession`.
  The global Android overview is **read-only**. Global credentials are NEVER a
  department MobileSession or a shortcut into departmental financial APIs.
- **Department officers** authenticate via `/api/mobile/orgs/:org/auth/*` and
  a tenant-bound `MobileSession`. The backend checks Active user, Active
  organization, matching tenant, and **current saved role/tabs on each call**.
- Tenant `TenantUser.role` is preserved exactly, including `superadmin` when
  it occurs on an existing department account. Such an account is **not**
  a global superadmin unless independently authenticated in the global flow.
- Admin/administrator/master have the same role-wide web grants as
  `lib/role-permissions.ts`. Other roles use explicit allowed tabs when saved
  and role presets otherwise; the Android UI receives effective server grants.
- On resume and on the officer permission screen, Android refreshes the session
  from the API. The API remains authoritative even if local UI is stale.
- `Tabs.Protected` guards are used for deep links into Collect, Verify, and
  Students; the root Stack also guards remittance details.

## Permission matrix (default web presets)

| Permission | Admin | Treasurer | Auditor | Viewer | Mobile preview |
|---|:---:|:---:|:---:|:---:|---|
| Overview | ✓ | ✓ | ✓ | ✓ | Read-only, when granted |
| Students | ✓ | — | — | — | Read-only; also accessible with Payment tab |
| Clearance | ✓ | ✓ | ✓ | ✓ | Status lookup (details require officer authorization) |
| Payments | ✓ | ✓ | — | — | Posting paused for all roles |
| Online remittances | ✓ | ✓ | — | — | Read-only pending queue and proof details |
| Reports | ✓ | ✓ | ✓ | ✓ | Web-only |
| Penalties | ✓ | ✓ | — | — | Web-only |
| Cash advances | ✓ | ✓ | — | — | Web-only |
| Audit | ✓ | — | ✓ | — | Web-only |
| Collectibles | ✓ | ✓ | — | — | Web-only |
| Fund transfer | ✓ | ✓ | — | — | Web-only |
| Void center / Officers / Setup | ✓ | See actual saved tabs | See actual saved tabs | See actual saved tabs | Web-only |

**Custom saved tabs override non-admin preset lists**, so matrix values are
defaults, not individual-user entitlements. All access is verified server-side.

## Manual acceptance scenarios

1. **Global Superadmin:** OTP login, global overview, role counts for
   organizations, sign-out. A global token requesting
   `GET /api/mobile/orgs/jiecep/dashboard` MUST be rejected (401/403).
2. **Department admin:** shows the web role label and assigned modules. Can
   read overview, roster and remittance queue if granted. Cannot post payments.
3. **Treasurer with tab-remittances only:** can load the pending queue and proof
   details even **without** tab-overview. Must not load general ledger or
   dashboard. Verification buttons are disabled.
4. **Auditor with custom tab-students:** can read roster if explicitly granted,
   cannot issue receipts. Its saved tabs supersede the default preset.
5. **Viewer:** sees only assigned modules; direct links to Collect, Verify,
   or Students are blocked without the relevant permission.
6. **Department role named superadmin:** never accesses global overview with an
   officer token. Actual tenant role text remains visible.
7. **Role changed in web:** when the app returns to the foreground or officer
   opens More, saved tab access updates. A revoked account cannot call any
   private mobile API, regardless of the device's cached UI state.
8. **Cross-department:** a JIECEP officer token is rejected for Janitorial
   queries regardless of identical emails or role names.
9. **Production:** main branch, production Neon database and existing
   production API remain unchanged.

## Repeatable source-policy checks

Run from repository root (Node 22 or later):

```powershell
npm run test:mobile-roles
```

Run actual TypeScript and build checks too:

```powershell
npm ci
npx prisma generate
npx tsc --noEmit
cd mobile
npm ci
npm run typecheck
```

When approved, build an **internal Preview** APK only:

```powershell
npx eas-cli build --platform android --profile preview
```

A successful static policy test is not a substitute for authenticated
end-to-end tests, Vercel Preview environment isolation, or financial-integrity
approval. `PAYMENT_WRITES_ENABLED` must remain false for every mobile role.
