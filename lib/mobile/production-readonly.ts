// Fail-closed mobile business-action allowlist. Operational modules may be
// accessed through the existing permissioned web app, and only explicitly
// allowlisted native tenant operations can be enabled. Client controls alone
// never authorize financial or business mutations.
// Authentication (OTP issuance, session creation and logout) necessarily writes
// session/throttle/audit metadata, but never financial or tenant business data.
//
// Preview provisioning remains isolated; Production tenant provisioning
// requires an independent server opt-in and the global administrator's session.

type MobileEnvironment = {
  vercelEnv?: string | null;
  gitRef?: string | null;
  /** Explicit Production opt-in, configured server-side only after authorization QA. */
  tenantOperationsEnabled?: boolean;
};

const GLOBAL_OTP = /^\/api\/mobile\/global\/auth\/(?:request-code|verify-code)$/;
const OFFICER_OTP = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/auth\/(?:request-code|verify-code)$/;
const STUDENT_OTP = /^\/api\/mobile\/orgs\/[a-z0-9-]+\/clearance\/auth\/(?:request-code|verify-code)$/;
const STUDENT_LOGOUT = /^\/api\/mobile\/orgs\/[a-z0-9-]+\/clearance\/auth\/session$/;
// Only the six verified profile/email identity endpoints can mutate account
// metadata. Never treat these as permission for business or financial writes.
const OFFICER_PROFILE_EMAIL = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/profile\/email\/(?:request-current|verify-current|request-new|confirm)$/;
const STUDENT_EMAIL_CHANGE = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/clearance\/email-change\/(?:request-new|confirm)$/;
// Session-only collaboration metadata. Does not authorize a business mutation.
const OFFICER_COLLABORATION = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/(?:presence|onboarding)$/;
const OFFICER_WEB_HANDOFF = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/auth\/web-handoff$/;
const GLOBAL_WEB_HANDOFF = '/api/mobile/global/auth/web-handoff';
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

  // Ticket issuance is an authenticated identity operation, never a business write.
  // Endpoint itself also checks the independent production-only feature flag.
  if (verb === 'POST' && (OFFICER_WEB_HANDOFF.test(path) || path === GLOBAL_WEB_HANDOFF)) return true;

  // Login and logout are identity/session operations, not business transactions.
  if (verb === 'POST' && (GLOBAL_OTP.test(path) || OFFICER_OTP.test(path) || STUDENT_OTP.test(path))) return true;
  if (verb === 'DELETE' && (path === GLOBAL_LOGOUT || OFFICER_LOGOUT.test(path) || STUDENT_LOGOUT.test(path))) return true;
  if (verb === 'POST' && (OFFICER_PROFILE_EMAIL.test(path) || STUDENT_EMAIL_CHANGE.test(path))) return true;
  if ((verb === 'POST' || verb === 'DELETE') && OFFICER_COLLABORATION.test(path)) {
    return verb === 'POST' || path.endsWith('/presence');
  }

  // Do not broaden this gate based on a user-supplied role, header or body.
  if (
    verb === 'POST' &&
    env.vercelEnv === 'preview' &&
    env.gitRef === 'android-parity-integration' &&
    PREVIEW_BUSINESS_POSTS.has(path)
  ) return true;

  // Production operational rollout is opt-in per capability, NOT a broad
  // "write enabled" switch. Only two existing audited tenant-management routes
  // qualify; authorization, confirmation and transaction validation still run
  // inside their handlers. This cannot admit payment/receipt/proof writes.
  if (
    verb === 'POST' &&
    env.vercelEnv === 'production' &&
    env.gitRef === 'main' &&
    env.tenantOperationsEnabled === true &&
    PREVIEW_BUSINESS_POSTS.has(path)
  ) return true;

  // Financial posting, remittance approval, proof uploads, other tenant mutations,
  // future mutation endpoints and unrecognized methods are denied by default.
  return false;
}
