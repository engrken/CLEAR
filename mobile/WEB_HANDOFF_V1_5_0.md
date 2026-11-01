# Android v1.5.0 — Mobile-to-Web signed-in handoff

## User experience
A signed-in officer, tenant Administrator, or Global Administrator selects **Switch to Web Portal**. The first-party CLEAR web destination opens with a separate web session, without a second OTP **only if secure handoff succeeds**. Failed or expired handoffs fall back to normal web login.

## Release-blocking protocol
1. Authenticated POST issuance revalidates the active mobile bearer session, officer or Global Administrator, tenant, role, revocation, maintenance, and session version.
2. Generate at least 256 bits of cryptographic randomness. Persist only a keyed hash, principal type and ID, tenant ID, approved destination, mobile session reference, expiration no longer than 60 seconds, and consumption state.
3. Return only a fixed first-party HTTPS URL. Never place the mobile bearer token or OTP in the browser URL. Do not log, persist locally, or send the handoff secret to analytics.
4. Redeem atomically exactly once. Recheck tenant and identity status, then establish a separate NextAuth session through a dedicated, restricted credentials provider. Never forge a NextAuth cookie.
5. Redirect immediately to a clean URL. Redemption response must disable caching and referrers. Replay and simultaneous redemption fail closed.
6. Tenant sessions preserve the exact tenant and current role. Global Administrator sessions use existing global session-version checks and never impersonate tenant officers.
7. Rate-limit and audit issuance and redemption without secrets. Test expiry, replay, simultaneous redemption, cross-tenant attempts, maintenance, inactive accounts, and role separation.
8. Keep issuance disabled until isolated migration, integration tests, and APK UAT pass. Existing browser links continue to require independent web login.

## Current status
**Specified, not enabled.** This feature is required for v1.5.0 but must not be represented as working until the complete server exchange and NextAuth integration pass security tests.