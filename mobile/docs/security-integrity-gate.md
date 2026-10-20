# CLEAR Android — Security and Data Integrity Gate

Status: audit baseline (not a release approval). Scope: `mobile/apk-only` and current web `main`.

## Verified observations
- Mobile app uses Expo/React Native and selects mock or HTTP API with `EXPO_PUBLIC_API_MODE`. Release builds must reject mock mode and non-HTTPS production endpoints.
- Mobile bearer sessions are stored as SHA-256 token hashes; API checks active officer, organization and tab permissions.
- The mobile payment endpoint does not accept an explicit idempotency key.
- `lib/mobile/payments.ts` uses a serializable Prisma transaction and retries P2034 conflicts. It mirrors web payment logic, so rule drift is possible.
- Mobile branch and main have diverged. Do not merge wholesale without reviewing schema, API and financial changes.

## Release-blocking verification checklist
- [ ] Compare all mobile API routes against current main schema and authorization rules.
- [ ] Enforce tenant scoping on every read/write, including object-ID routes.
- [ ] Add server-enforced idempotency for payment creation and remittance verification. Key must be scoped to organization + actor + operation; persist request fingerprint, outcome and unique constraint atomically with financial write. Same key/different payload must return conflict.
- [ ] Confirm unique official receipt constraints and all package receipt line behavior under concurrency.
- [ ] Validate money using integer centavos and server-side assessment values.
- [ ] Verify retry, timeout, double-tap and simultaneous-officer payment scenarios without duplicate ledger entries.
- [ ] Verify revocation, expired token, disabled officer and cross-department access.
- [ ] Confirm production builds use HTTPS live API and cannot enable demo/mock mode.
- [ ] Check sensitive data handling, SecureStore, Android backups, logs and screenshot exposure.
- [ ] Run database migration and restore rehearsal in an isolated environment.
- [ ] Run typecheck, lint, mobile build, integration tests and staged release testing.

## Non-production test cases
1. Same idempotency key + identical payment payload twice -> one financial posting, identical recorded result.
2. Same key + different amount -> 409; no additional posting.
3. Concurrent different keys against one remaining balance -> never overpay.
4. Simultaneous penalty settlement -> only permitted balance reduction; receipt and settlement event stay consistent.
5. Cross-tenant token and object ID -> denied; no record leakage.
6. Expired/revoked officer token -> 401; no write.
7. Network timeout after server commit -> retry returns existing result.
8. Receipt/ledger/audit/outbox transaction failure -> all-or-nothing.

Do not run destructive tests against production financial records. No release until all critical checks pass.
