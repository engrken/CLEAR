import * as WebBrowser from 'expo-web-browser';

// Public pages on the web app. Always production: the policy is the same for every build.
// The privacy policy is the one on the CLEAR web app (clearsys.vercel.app).
export const PRIVACY_URL = 'https://clearsys.vercel.app/privacy';
// The deletion page exists only on clear.rupertbulquerin.com so far; move it here
// once clearsys.vercel.app serves /account-deletion (Google Play links to it).
export const ACCOUNT_DELETION_URL = 'https://clear.rupertbulquerin.com/account-deletion';

/** Open a web page in the in-app browser tab. */
export function openWebPage(url: string) {
  return WebBrowser.openBrowserAsync(url);
}

// Signed-in mobile sessions are NOT shared with the web application.
// Launch only fixed, first-party HTTPS locations; users authenticate
// independently on the web and its server performs every permission check.
const CLEAR_WEB_APP = 'https://clearsys.vercel.app';
const WEB_MODULE_PATHS = new Set([
  '/summary', '/students', '/clearance', '/collections', '/collections/history', '/remittances',
  '/penalties', '/advances', '/liquidations', '/collectibles', '/reports',
  '/void', '/realign', '/users', '/setup',
]);

function safeDepartmentUrl(slug: string, route = ''): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Invalid department address.');
  }
  if (route && !WEB_MODULE_PATHS.has(route)) {
    throw new Error('Unknown CLEAR web module.');
  }
  return `${CLEAR_WEB_APP}/department/${encodeURIComponent(slug)}${route}`;
}

/** Additional student services; never put student IDs or OTP tokens in URLs. */
export function openDepartmentWebPortal(slug: string) {
  return openWebPage(safeDepartmentUrl(slug));
}

/** Web-owned operational modules require independent web authentication. */
export function openDepartmentModule(slug: string, route: string) {
  return openWebPage(safeDepartmentUrl(slug, route));
}

/** Existing audited Global Superadmin tenant workflow. */
export function openGlobalAdministrationPortal() {
  return openWebPage(`${CLEAR_WEB_APP}/dashboard/provisions`);
}
/** The existing audited global maintenance scheduling/recovery console. */
export function openGlobalMaintenancePortal() {
  return openWebPage(`${CLEAR_WEB_APP}/dashboard/provisions/maintenance`);
}

/** First-party browser portal fallback while single-use SSO remains disabled. */
export async function switchToDepartmentWebPortal(slug: string) {
  return openDepartmentWebPortal(slug);
}

export async function switchToGlobalWebPortal() {
  return openGlobalAdministrationPortal();
}

/** Authenticated handoff: only server-issued URLs validated against fixed origin. */
export async function openVerifiedWebHandoff(url: unknown) {
  const { validateWebHandoffUrl } = await import('./web-handoff');
  return openWebPage(validateWebHandoffUrl(url));
}
