// Backend configuration. Release builds must never use mock data or plaintext HTTP.
// Development builds may use an emulator's local HTTP endpoint.
const PROD_URL = 'https://clearsys.vercel.app/api/mobile';
// Integration branch safety gate: payment writes must not be enabled until
// the canonical web transaction service has been ported and verified.
export const PAYMENT_WRITES_ENABLED = false;
// Remittance decisions are separately authorized; enabling collection payments
// must never unlock verification, invalidation or handwritten receipt controls.
export const REMITTANCE_WRITES_ENABLED = false;
// Student Roster editing is independent of any financial write feature.
// UAT builds must explicitly opt in; the backend decides whether the actor is authorized.
export const STUDENT_ROSTER_WRITES_ENABLED = process.env.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES === 'true' &&
  process.env.EXPO_PUBLIC_CLEAR_RELEASE_KIND !== 'live-readonly-internal';
// The read-only legacy build has no student proof or generic business writes.
// Keep this fail-closed independently of role, APK environment and UI navigation.
export const MOBILE_BUSINESS_WRITES_ENABLED = false;
// v1.2.2 can request native tenant operations only when explicitly built for it.
// The server independently requires MOBILE_TENANT_OPERATIONS_ENABLED=true,
// Production main and a verified Global Superadmin session.
// Payment posting, proofs and remittance verification remain separately blocked.
export const TENANT_OPERATIONS_ENABLED = process.env.EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS === 'true';
const DEV_URL = 'http://localhost:3000/api/mobile';

const configuredMode = process.env.EXPO_PUBLIC_API_MODE;
const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
const apiUrl = (configuredUrl || (__DEV__ ? DEV_URL : PROD_URL)).replace(/\/+$/, '');

// A separately identified internal Production viewer APK cannot silently inherit
// the Preview API alias or a third-party endpoint from EAS/project variables.
// Existing preview builds remain pointed to their intentionally isolated backend.
const releaseKind = process.env.EXPO_PUBLIC_CLEAR_RELEASE_KIND;
if (releaseKind === 'live-readonly-internal') {
  if (__DEV__ || configuredMode === 'mock' || apiUrl !== PROD_URL) {
    throw new Error('CLEAR live viewer release must use the pinned Production HTTPS API.');
  }
  if (PAYMENT_WRITES_ENABLED !== false || REMITTANCE_WRITES_ENABLED !== false || STUDENT_ROSTER_WRITES_ENABLED !== false || MOBILE_BUSINESS_WRITES_ENABLED !== false || TENANT_OPERATIONS_ENABLED !== false) {
    throw new Error('CLEAR live viewer may not enable business transactions.');
  }
}


// v1.5 APK and Play AAB use the same real Production API and role rules. The
// Android flag only exposes roster controls; the web backend separately checks
// the signed-in officer's Student permission and a server-side write rollout.
if (releaseKind === 'v15-production-uat' || releaseKind === 'v15-production') {
  if (__DEV__ || configuredMode === 'mock' || apiUrl !== PROD_URL ||
      PAYMENT_WRITES_ENABLED !== false || REMITTANCE_WRITES_ENABLED !== false ||
      MOBILE_BUSINESS_WRITES_ENABLED !== false || TENANT_OPERATIONS_ENABLED !== false ||
      STUDENT_ROSTER_WRITES_ENABLED !== true) {
    throw new Error('CLEAR v1.5 live build requires Production HTTPS, server-gated roster edits, and read-only finance.');
  }
}

if (!__DEV__) {
  if (configuredMode === 'mock') {
    throw new Error('CLEAR security policy: mock API is prohibited in release builds.');
  }
  if (!/^https:\/\/[^\s/?#]+(?:\/|$)/i.test(apiUrl)) {
    throw new Error('CLEAR security policy: release API endpoint must use HTTPS.');
  }
}

export const API_MODE: 'http' | 'mock' = __DEV__ && configuredMode === 'mock' ? 'mock' : 'http';
export const API_URL = apiUrl;
