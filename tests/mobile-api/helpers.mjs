// /tests/mobile-api/helpers.mjs
//
// Shared plumbing for the mobile REST API end-to-end suite (`npm run test:api`).
// The suite talks to a running dev server over HTTP and reaches into the LOCAL
// dev database (prisma/seed-dev.js data) to re-seed, clear sign-in throttling and
// plant known sign-in codes. Every database helper refuses to run unless both
// DATABASE_URL and API_URL point at localhost, so it can never touch production.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prismaPkg from '@prisma/client';

const { PrismaClient } = prismaPkg;

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const API_URL = (process.env.API_URL || 'http://localhost:3000/api/mobile').replace(/\/+$/, '');
export const KNOWN_CODE = '246810';
export const AY = 'A.Y. 2026 - 2027';
export const TERM = '1st Sem';

// Seed data (prisma/seed-dev.js)
export const ORGS = ['devdept', 'otherdept'];
export const FEE_CENTAVOS = { 'Membership Fee': 15000, 'Org Shirt': 35000, 'Acquaintance Party': 20000 };
export const PACKAGE_CENTAVOS = 70000;
export const ALL_TABS = [
  'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
  'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
  'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
  'tab-transfer', 'tab-users', 'tab-setup',
];
export const ROLE_TABS = {
  admin: ALL_TABS,
  treasurer: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-payment',
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-collectibles',
    'tab-report', 'tab-transfer',
  ],
  auditor: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'],
  viewer: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'],
};

export const emailOf = (org, role) => `${role}@${org}.local`;

// Play reviewer demo org (prisma/seed-demo.js); sign-in needs both variables in
// .env, which the dev server and this suite both read.
export const DEMO_ORG = 'demo';
export const DEMO_EMAIL = String(process.env.DEMO_REVIEWER_EMAIL || '').trim().toLowerCase();
export const DEMO_CODE = String(process.env.DEMO_REVIEWER_CODE || '').trim();
export const DEMO_ON = Boolean(DEMO_EMAIL && /^\d{6}$/.test(DEMO_CODE));
export const schoolId = (org, n) => `${org === 'devdept' ? 'DEV' : 'OTH'}-2026-${String(n).padStart(4, '0')}`;

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Throws unless the database and the API under test are both local. */
export function assertLocalOnly() {
  const dbHost = hostOf(process.env.DATABASE_URL || '');
  if (!LOCAL_HOSTS.includes(dbHost)) {
    throw new Error(`Refusing to run: DATABASE_URL host is "${dbHost || 'unset'}", not localhost.`);
  }
  const apiHost = hostOf(API_URL);
  if (!LOCAL_HOSTS.includes(apiHost)) {
    throw new Error(`Refusing to run: API_URL host is "${apiHost || 'unset'}", not localhost.`);
  }
}

assertLocalOnly();

export const prisma = new PrismaClient();

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hashToken = sha256;

let seq = 0;
/** Unique-per-run string, e.g. for OR and reference numbers (upper case: the API normalizes ORs). */
export const uniq = (prefix) => `${prefix}-${Date.now().toString(36)}-${++seq}`.toUpperCase();

// ---------------------------------------------------------------- HTTP

/**
 * Calls the API. `json` sends a JSON body, `form` a FormData (multipart).
 * Returns { status, data, headers } with `data` parsed from JSON when possible.
 */
export async function api(method, urlPath, { token, json, form, headers } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    h['Content-Type'] = 'application/json';
    body = typeof json === 'string' ? json : JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(API_URL + urlPath, { method, headers: h, body });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data, headers: res.headers };
}

const show = (res) => `HTTP ${res.status} ${typeof res.data === 'string' ? res.data.slice(0, 300) : JSON.stringify(res.data)}`;

export function expectStatus(res, status) {
  assert.equal(res.status, status, `expected HTTP ${status}, got ${show(res)}`);
  return res.data;
}

/** Asserts the spec's error shape: status + { error: { code, message } }. */
export function expectError(res, status, code) {
  assert.equal(res.status, status, `expected HTTP ${status} ${code}, got ${show(res)}`);
  assert.equal(res.data?.error?.code, code, `expected error code ${code}, got ${show(res)}`);
  assert.equal(typeof res.data.error.message, 'string');
  assert.ok(res.data.error.message.length > 0, 'error.message should not be empty');
}

/** Asserts a failure in the spec's error shape whose status is one of `statuses`. */
export function expectAnyError(res, statuses) {
  assert.ok(statuses.includes(res.status), `expected HTTP ${statuses.join('/')}, got ${show(res)}`);
  assert.equal(typeof res.data?.error?.code, 'string', `missing error.code: ${show(res)}`);
}

export function assertCentavos(value, label) {
  assert.ok(Number.isInteger(value), `${label} should be integer centavos, got ${JSON.stringify(value)}`);
}

export function assertIsoDate(value, label) {
  assert.equal(typeof value, 'string', `${label} should be a string`);
  assert.ok(!Number.isNaN(Date.parse(value)), `${label} should be a date, got ${value}`);
}

export const LEDGER_KINDS = ['collection', 'online-remittance', 'penalty', 'advance', 'cashier-remittance'];

export function assertLedgerEntry(e) {
  assert.equal(typeof e.id, 'string');
  assert.ok(LEDGER_KINDS.includes(e.kind), `unexpected kind ${e.kind}`);
  for (const k of ['title', 'reference', 'subtitle', 'status']) assert.equal(typeof e[k], 'string', `LedgerEntry.${k}`);
  assertCentavos(e.amountCentavos, 'LedgerEntry.amountCentavos');
  assertIsoDate(e.at, 'LedgerEntry.at');
}

export function assertOrganization(o) {
  assert.equal(typeof o.subdomain, 'string');
  assert.equal(typeof o.name, 'string');
  assert.ok(['Department', 'Organization'].includes(o.type), `unexpected type ${o.type}`);
  assert.ok(o.logoUrl === null || typeof o.logoUrl === 'string');
  assert.equal(typeof o.activeAy, 'string');
  assert.equal(typeof o.activeTerm, 'string');
  assert.ok(!('id' in o), 'Organization should not expose the internal database id');
}

export function assertOfficer(o, { org, role }) {
  assert.equal(typeof o.id, 'string');
  assert.equal(typeof o.fullName, 'string');
  assert.equal(o.email, emailOf(org, role));
  assert.equal(o.role, role);
  assert.ok(Array.isArray(o.allowedTabs), 'allowedTabs should be an array');
  assert.deepEqual([...o.allowedTabs].sort(), [...ROLE_TABS[role]].sort());
  for (const k of ['otpCode', 'otpExpires', 'allowedTabsJson']) assert.ok(!(k in o), `Officer leaks ${k}`);
}

// ---------------------------------------------------------------- Data

/** Fails fast with a clear message when the dev server is not answering. */
export async function assertServerUp() {
  try {
    const res = await fetch(`${API_URL}/orgs`);
    if (res.status >= 500 || res.status === 404) {
      throw new Error(`GET ${API_URL}/orgs answered HTTP ${res.status}`);
    }
  } catch (err) {
    throw new Error(`Mobile API not reachable at ${API_URL} (${err.message}). Start the dev server (npm run dev) first.`);
  }
}

/** Removes sign-in throttling (cooldown, failures, lockout) for the dev orgs, and proof-upload limits. */
export async function clearThrottle(org, email) {
  assertLocalOnly();
  // The daily code cap (TenantUser.otpRequestCount) counts too: the suite signs the same officers in often.
  await prisma.tenantUser.updateMany({
    where: { organization: { subdomain: { in: email ? [org] : ORGS } }, ...(email ? { email } : {}) },
    data: { otpRequestCount: 0, otpLastRequestedAt: null },
  });
  if (email) {
    await prisma.authThrottle.deleteMany({ where: { key: `otp:${org}:${email.toLowerCase()}` } });
  } else {
    await prisma.authThrottle.deleteMany({
      where: { OR: [...ORGS.map((o) => ({ key: { startsWith: `otp:${o}:` } })), { key: { startsWith: 'proof:' } }] },
    });
  }
}

/**
 * Re-creates devdept/otherdept from prisma/seed-dev.js (which has its own
 * localhost guard) and clears their sign-in throttling. Sessions, payments and
 * remittances of those orgs go with them (cascade).
 */
export async function resetData() {
  assertLocalOnly();
  await assertServerUp();
  const run = spawnSync(process.execPath, ['prisma/seed-dev.js'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`seed-dev failed:\n${run.stdout}\n${run.stderr}`);
  await clearThrottle();
}

/** Runs a repo script with the suite's env (scripts carry their own localhost guards). */
export function runScript(script, args = []) {
  assertLocalOnly();
  const run = spawnSync(process.execPath, [script, ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}
${run.stderr}` };
}

/** Re-creates the demo org (prisma/seed-demo.js --yes, local only) and clears its throttling. */
export async function resetDemo() {
  assertLocalOnly();
  await assertServerUp();
  const run = runScript('prisma/seed-demo.js', ['--yes']);
  if (run.status !== 0) throw new Error(`seed-demo failed:
${run.out}`);
}

export async function orgRow(org) {
  return prisma.organization.findUniqueOrThrow({ where: { subdomain: org } });
}

export async function officerRow(org, role) {
  const o = await orgRow(org);
  return prisma.tenantUser.findFirstOrThrow({ where: { organizationId: o.id, email: emailOf(org, role) } });
}

export async function studentRow(org, n) {
  const o = await orgRow(org);
  return prisma.student.findFirstOrThrow({ where: { organizationId: o.id, studentId: schoolId(org, n) } });
}

export async function feeRow(org, name) {
  const o = await orgRow(org);
  return prisma.collectionSetup.findFirstOrThrow({ where: { organizationId: o.id, name } });
}

/** Overwrites an officer's pending sign-in code with KNOWN_CODE (valid 5 min). */
export async function setKnownCode(org, email, { expires = new Date(Date.now() + 5 * 60 * 1000) } = {}) {
  assertLocalOnly();
  const o = await orgRow(org);
  const { count } = await prisma.tenantUser.updateMany({
    where: { organizationId: o.id, email },
    data: { otpCode: sha256(KNOWN_CODE), otpExpires: expires },
  });
  assert.equal(count, 1, `no officer ${email} in ${org}`);
}

/** Requests a code through the API, plants KNOWN_CODE and verifies it. Returns the Session. */
export async function signIn(org, role) {
  const email = emailOf(org, role);
  await clearThrottle(org, email);
  expectStatus(await api('POST', `/orgs/${org}/auth/request-code`, { json: { email } }), 200);
  await setKnownCode(org, email);
  const session = expectStatus(await api('POST', `/orgs/${org}/auth/verify-code`, { json: { email, code: KNOWN_CODE } }), 200);
  assert.equal(typeof session.token, 'string');
  return session;
}

// ---------------------------------------------------------------- Proofs

// 1x1 transparent PNG
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export const pngFile = () => ({ blob: new Blob([PNG_1X1], { type: 'image/png' }), name: 'proof.png' });

export function proofForm({
  studentId,
  amountCentavos = 15000,
  itemDescription = 'Membership Fee',
  referenceNumber = uniq('REF'),
  paymentChannel = 'GCash',
  file = pngFile(),
} = {}) {
  const fd = new FormData();
  if (studentId !== undefined) fd.set('studentId', studentId);
  fd.set('paymentChannel', paymentChannel);
  fd.set('referenceNumber', referenceNumber);
  fd.set('amountCentavos', String(amountCentavos));
  fd.set('itemDescription', itemDescription);
  if (file) fd.set('proof', file.blob, file.name);
  return fd;
}

/** Submits a public proof and returns { submissionId, id } (id = OnlineRemittance.id). */
export async function submitProof(org, opts) {
  const res = await api('POST', `/orgs/${org}/proofs`, { form: proofForm(opts) });
  const { submissionId } = expectStatus(res, 201);
  const row = await prisma.onlineRemittance.findUniqueOrThrow({ where: { submissionId } });
  return { submissionId, id: row.id };
}
