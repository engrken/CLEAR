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
  /** Isolated, independent roster editing authorization. */
  rosterWritesEnabled?: boolean;
  /** Independent opt-in: role-scoped non-financial officer status changes only. */
  tenantUserWritesEnabled?: boolean;
  /** Never permit an unverified Vercel Preview environment to mutate real rosters. */
  localRosterCiOnly?: boolean;
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

// This only admits a route to its own authorization and accounting handler.
// It never grants the mobile user permission to post a transaction.
const TENANT_USERS_STATUS_POST = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/users$/;
const STUDENT_ROSTER_POST = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/students\/manage$/;
const FINANCIAL_POSTS = /^\/api\/mobile\/orgs\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\/payments$/;

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

  // v1.5.0 policy: mobile cash posting is web-only in EVERY environment.
  // Environment variables, CI fixtures or future broad operational flags
  // must never enable this endpoint. Keep the explicit deny before opt-ins.
  if (verb === 'POST' && FINANCIAL_POSTS.test(path)) return false;

  if (verb === 'POST' && STUDENT_ROSTER_POST.test(path) &&
      canRunMobileRosterWrites(env)) return true;
  if (verb === 'POST' && TENANT_USERS_STATUS_POST.test(path) &&
      canRunMobileTenantUserWrites(env)) return true;

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

  // Unapproved financial posting, remittance approval, proof uploads, other tenant mutations,
  // future mutation endpoints and unrecognized methods are denied by default.
  return false;
}

/** No roster operations on arbitrary previews or with a client-only flag. */
export function canRunMobileRosterWrites(env: MobileEnvironment): boolean {
  return env.rosterWritesEnabled === true && (
    (env.vercelEnv === 'production' && env.gitRef === 'main') ||
    (env.vercelEnv === 'preview' &&
      env.gitRef === 'feature/android-v1.5.0-write-foundation-20261101' &&
      env.localRosterCiOnly === true)
  );
}

/** One server-side source for both write-capability advertising and routing. */
export function mobileRosterWriteEnvironment(): MobileEnvironment {
  return {
    vercelEnv: process.env.VERCEL_ENV,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF,
    rosterWritesEnabled: process.env.MOBILE_STUDENT_ROSTER_WRITES_ENABLED === 'true',
    localRosterCiOnly: process.env.CI === 'true' &&
      process.env.CLEAR_CI_FINANCE_TEST_ENABLED === '1' &&
      process.env.AUTH_URL === 'http://127.0.0.1:3100' &&
      process.env.DATABASE_URL ===
        'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public',
  };
}

/** Same explicit deployment/CI isolation policy as roster edits, never a financial permission. */
export function canRunMobileTenantUserWrites(env: MobileEnvironment): boolean {
  return env.tenantUserWritesEnabled === true && (
    (env.vercelEnv === 'production' && env.gitRef === 'main') ||
    (env.vercelEnv === 'preview' &&
      env.gitRef === 'feature/android-v1.5.0-write-foundation-20261101' &&
      env.localRosterCiOnly === true)
  );
}
export function mobileTenantUserWriteEnvironment(): MobileEnvironment {
  return { ...mobileRosterWriteEnvironment(),
    tenantUserWritesEnabled: process.env.MOBILE_TENANT_USER_WRITES_ENABLED === 'true' };
}
