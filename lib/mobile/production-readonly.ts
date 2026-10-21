// Fail-closed mobile business-action allowlist. The app is a viewer of the
// canonical CLEAR web ledger; client-side controls are never the security gate.
// Authentication (OTP issuance, session creation and logout) necessarily writes
// session/throttle/audit metadata, but never financial or tenant business data.
//
// Preview-only provisioning is retained for the isolated Release 1.2.0 QA
// environment; it is never admitted on Production or an unknown environment.

type MobileEnvironment = {
  vercelEnv?: string | null;
  gitRef?: string | null;
};

const GLOBAL_OTP = /^\/api\/mobile\/global\/auth\/(?:request-code|verify-code)$/;
const OFFICER_OTP = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/auth\/(?:request-code|verify-code)$/;
const STUDENT_OTP = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/student-auth\/(?:request-code|verify-code)$/;
const STUDENT_LOGOUT = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/student-auth\/session$/;
const GLOBAL_LOGOUT = '/api/mobile/global/auth/session';
const OFFICER_LOGOUT = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/auth\/session$/;

const PREVIEW_BUSINESS_POSTS = new Set([
  '/api/mobile/global/provisions',
  '/api/mobile/global/provisions/manage',
]);

export function isMobileRequestAllowed(
  method: string,
  pathname: string,
  env: MobileEnvironment = {}
): boolean {
  const verb = String(method || '').toUpperCase();
  const path = String(pathname || '').replace(/\/+$/, '');

  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;

  // Login and logout are identity/session operations, not business transactions.
  if (verb === 'POST' && (GLOBAL_OTP.test(path) || OFFICER_OTP.test(path) || STUDENT_OTP.test(path))) return true;
  if (verb === 'DELETE' && (path === GLOBAL_LOGOUT || OFFICER_LOGOUT.test(path) || STUDENT_LOGOUT.test(path))) return true;

  // Do not broaden this gate based on a user-supplied role, header or body.
  if (
    verb === 'POST' &&
    env.vercelEnv === 'preview' &&
    env.gitRef === 'android-parity-integration' &&
    PREVIEW_BUSINESS_POSTS.has(path)
  ) return true;

  // Financial posting, remittance approval, proof uploads, tenant lifecycle,
  // future mutation endpoints and unrecognized methods are denied by default.
  return false;
}
