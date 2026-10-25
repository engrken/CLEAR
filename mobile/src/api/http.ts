// Fetch client for the CLEAR mobile REST API (see the web app's app/api/mobile/**).

import { Platform } from 'react-native';

import { API_URL, MOBILE_BUSINESS_WRITES_ENABLED, PAYMENT_WRITES_ENABLED, TENANT_OPERATIONS_ENABLED } from './config';
import { fallbackMessage } from './errors';
import { ApiError, type ClearApi, type GlobalSession, type Session } from './types';

let onUnauthorized: (() => void) | null = null;

/** The session layer registers this to sign out when the server rejects a token. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

type Options = { method?: string; token?: string | null; json?: unknown; form?: FormData; idempotencyKey?: string; query?: Record<string, string | number | undefined> };

async function request<T>(path: string, { method = 'GET', token, json, form, idempotencyKey, query }: Options = {}): Promise<T> {
  const qs = query
    ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs === '?' ? '' : qs}`, {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
    });
  } catch {
    throw new ApiError('Can’t reach the CLEAR server. Check your connection and try again.', 'network');
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Usually { error: { code, message } }; also accept { error: 'message', code }.
    const err = typeof body?.error === 'string' ? { message: body.error, code: body?.code } : body?.error;
    const code: string = err?.code || (res.status === 429 ? 'rate_limited' : 'server_error');
    const e = new ApiError(err?.message || fallbackMessage(code, res.status), code, res.status);
    // A rejected token on an officer call ends the session everywhere.
    // A student clearance OTP token is independent from an officer/global login.
    // Its expiry must not sign an unrelated officer out of the application.
    if (res.status === 401 && token && !token.startsWith('clrs_')) onUnauthorized?.();
    throw e;
  }
  return body as T;
}

const org = (slug: string) => `/orgs/${encodeURIComponent(slug)}`;
const as = (s: Session) => ({ token: s.token });

async function proofForm(p: Parameters<ClearApi['submitProof']>[1]) {
  const form = new FormData();
  form.append('studentId', p.studentId.trim());
  form.append('paymentChannel', p.paymentChannel);
  form.append('referenceNumber', p.referenceNumber.trim());
  form.append('amountCentavos', String(p.amountCentavos));
  form.append('itemDescription', p.itemDescription);
  if (Platform.OS === 'web') {
    // On web the picker returns a blob: or data: URI; send real bytes.
    const blob = await (await fetch(p.file.uri)).blob();
    form.append('proof', blob, p.file.name);
  } else {
    // React Native's FormData streams the file from its URI.
    form.append('proof', { uri: p.file.uri, name: p.file.name, type: p.file.mimeType } as unknown as Blob);
  }
  return form;
}

export const httpApi: ClearApi = {
  mode: 'http',

  listOrganizations: () => request('/orgs'),
  getOrganization: (slug) => request(org(slug)),
  lookupClearance: (slug, q, session) =>
    request(`${org(slug)}/clearance`, { query: { q: q.trim() }, token: session?.org.subdomain === slug ? session.token : null }),
  requestStudentClearanceCode: (slug, studentId, email) =>
    request(`${org(slug)}/clearance/auth/request-code`, {
      method: 'POST', json: { studentId: studentId.trim(), email: email.trim().toLowerCase() },
    }),
  verifyStudentClearanceCode: (slug, studentId, email, code) =>
    request(`${org(slug)}/clearance/auth/verify-code`, {
      method: 'POST', json: { studentId: studentId.trim(), email: email.trim().toLowerCase(), code: code.trim() },
    }),
  getOwnClearance: (slug, studentToken) =>
    request(`${org(slug)}/clearance`, { token: studentToken }),
  revokeStudentClearance: async (slug, studentToken) => {
    try {
      await request(`${org(slug)}/clearance/auth/session`, { method: 'DELETE', token: studentToken });
    } catch {
      // A short-lived student token is also discarded locally on exit.
    }
  },
  listFeeItems: (slug) => request(`${org(slug)}/fees`),
  submitProof: async (slug, p) => MOBILE_BUSINESS_WRITES_ENABLED ?
    request(`${org(slug)}/proofs`, { method: 'POST', form: await proofForm(p) }) :
    Promise.reject(new ApiError('Receipt submissions are unavailable in the read-only viewer.', 'read_only')),

  requestCode: (slug, email) => request(`${org(slug)}/auth/request-code`, { method: 'POST', json: { email: email.trim().toLowerCase() } }),
  verifyCode: (slug, email, code) =>
    request(`${org(slug)}/auth/verify-code`, { method: 'POST', json: { email: email.trim().toLowerCase(), code } }),
  restoreSession: async (slug, token) => {
    const s = await request<Omit<Session, 'token'>>(`${org(slug)}/auth/session`, { token });
    return { ...s, token };
  },
  signOut: async (s) => {
    try {
      await request(`${org(s.org.subdomain)}/auth/session`, { method: 'DELETE', ...as(s) });
    } catch {
      // Signing out locally still works when the server can't be reached.
    }
  },

  requestOfficerEmailChangeCurrentCode: (s) =>
    request(`${org(s.org.subdomain)}/profile/email/request-current`, { method: 'POST', ...as(s) }),
  verifyOfficerEmailChangeCurrentCode: (s, code) =>
    request(`${org(s.org.subdomain)}/profile/email/verify-current`, { method: 'POST', ...as(s), json: { code } }),
  requestOfficerEmailChangeNewCode: (s, newEmail) =>
    request(`${org(s.org.subdomain)}/profile/email/request-new`, { method: 'POST', ...as(s), json: { newEmail } }),
  confirmOfficerEmailChange: (s, newEmail, code) =>
    request(`${org(s.org.subdomain)}/profile/email/confirm`, { method: 'POST', ...as(s), json: { newEmail, code } }),

  requestGlobalCode: (email) => request('/global/auth/request-code', {
    method: 'POST', json: { email: email.trim().toLowerCase() },
  }),
  verifyGlobalCode: (email, code) => request('/global/auth/verify-code', {
    method: 'POST', json: { email: email.trim().toLowerCase(), code },
  }),
  restoreGlobalSession: async (token) => {
    const session = await request<Omit<GlobalSession, 'token'>>('/global/auth/session', { token });
    return { ...session, token };
  },
  signOutGlobal: async (session) => {
    try {
      await request('/global/auth/session', { token: session.token, method: 'DELETE' });
    } catch {
      // Local sign-out still clears the secure-store token while offline.
    }
  },
  getGlobalOverview: (session) => request('/global/overview', { token: session.token }),
  listManagedTenants: (session) => request('/global/provisions', { token: session.token }),
  provisionTenant: (session, payload) => TENANT_OPERATIONS_ENABLED ?
    request('/global/provisions', { token: session.token, method: 'POST', json: payload }) :
    Promise.reject(new ApiError('Tenant provisioning is not enabled in this Android build. Open the secure web portal.', 'read_only')),
  manageTenant: (session, payload) => TENANT_OPERATIONS_ENABLED ?
    request('/global/provisions/manage', { token: session.token, method: 'POST', json: payload }) :
    Promise.reject(new ApiError('Tenant changes are not enabled in this Android build. Open the secure web portal.', 'read_only')),
  getGlobalTenantDashboard: (s, slug) => request(`/global/orgs/${encodeURIComponent(slug)}/dashboard`, { token: s.token }),
  listGlobalTenantStudents: (s, slug, q) => request(`/global/orgs/${encodeURIComponent(slug)}/students`, { token: s.token, query: { q } }),
  listGlobalTenantLedger: (s, slug) => request(`/global/orgs/${encodeURIComponent(slug)}/ledger`, { token: s.token }),
  listGlobalTenantRemittances: (s, slug) => request(`/global/orgs/${encodeURIComponent(slug)}/remittances`, { token: s.token }),

  getOfficerOnboarding: (s) => request(`${org(s.org.subdomain)}/onboarding`, as(s)),
  completeOfficerOnboarding: (s) => request(`${org(s.org.subdomain)}/onboarding`, { method: 'POST', ...as(s) }),
  pulseOfficerPresence: (s, page, tabId) => request(`${org(s.org.subdomain)}/presence`, { method: 'POST', ...as(s), json: { page, tabId } }),
  leaveOfficerPresence: (s, tabId) => request(`${org(s.org.subdomain)}/presence`, { method: 'DELETE', ...as(s), json: { tabId } }),
  getTenantPortal: (s) => request(`${org(s.org.subdomain)}/portal`, as(s)),
  getDashboard: (s) => request(`${org(s.org.subdomain)}/dashboard`, as(s)),
  listLedger: (s, f) => request(`${org(s.org.subdomain)}/ledger`, { ...as(s), query: { status: f?.status, limit: f?.limit } }),
  searchReceiptReferences: (s, q) => request(`${org(s.org.subdomain)}/reference-search`, {
    ...as(s), query: { kind: 'receipts', q: q.trim() },
  }),
  searchVoidReferences: (s, q) => request(`${org(s.org.subdomain)}/reference-search`, {
    ...as(s), query: { kind: 'void', q: q.trim() },
  }),
  listPendingRemittances: (s) => request(`${org(s.org.subdomain)}/remittances/pending`, as(s)),
  listStudents: (s, q) => request(`${org(s.org.subdomain)}/students`, { ...as(s), query: { q } }),
  recordPayment: (s, p) => PAYMENT_WRITES_ENABLED ? request(`${org(s.org.subdomain)}/payments`, { method: 'POST', ...as(s), idempotencyKey: p.idempotencyKey, json: { studentId: p.studentId, feeId: p.feeId, amountCentavos: p.amountCentavos, orNumber: p.orNumber.trim() } }) : Promise.reject(new ApiError('Payment posting is disabled until Android financial parity is verified.', 'unavailable')),
  getRemittance: (s, id) => request(`${org(s.org.subdomain)}/remittances/${encodeURIComponent(id)}`, as(s)),
  verifyRemittance: (s, id, p) => PAYMENT_WRITES_ENABLED ?
    request(`${org(s.org.subdomain)}/remittances/${encodeURIComponent(id)}/verify`, { method: 'POST', ...as(s), json: { ...p, orNumber: p.orNumber.trim() } }) : Promise.reject(new ApiError('Remittance verification is disabled until Android financial parity is verified.', 'unavailable')),
  invalidateRemittance: (s, id) => PAYMENT_WRITES_ENABLED ?
    request(`${org(s.org.subdomain)}/remittances/${encodeURIComponent(id)}/invalidate`, { method: 'POST', ...as(s) }) : Promise.reject(new ApiError('Remittance invalidation is disabled until Android financial parity is verified.', 'unavailable')),
};
