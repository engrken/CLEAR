// In-memory stand-in for the mobile REST API, seeded like prisma/seed-dev.js.
// Selected with EXPO_PUBLIC_API_MODE=mock for offline demos. Mirrors the
// server's rules (error codes, hidden public balances, officer-typed OR numbers).

import {
  ApiError,
  type ClearApi, type FeeItem, type LedgerEntry, type Officer, type Organization, type Session, type Student,
} from './types';

export const DEMO_OTP = '123456';

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));

const AY = 'A.Y. 2026 - 2027';
const TERM = '1st Sem';

const ORGS: Organization[] = [
  { subdomain: 'devdept', name: 'Dev Department of Engineering', type: 'Department', logoUrl: null, activeAy: AY, activeTerm: TERM },
  // Trimester school, so term labels aren't assumed to be semesters.
  { subdomain: 'otherdept', name: 'Other Department (isolation test)', type: 'Department', logoUrl: null, activeAy: AY, activeTerm: '1st Trimester' },
];

const ALL_TABS = [
  'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 'tab-remittances', 'tab-penalties',
  'tab-advances', 'tab-audit', 'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
  'tab-transfer', 'tab-users', 'tab-setup',
];
const ROLE_TABS: Record<Officer['role'], string[]> = {
  admin: ALL_TABS,
  treasurer: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-collectibles', 'tab-report', 'tab-transfer'],
  auditor: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'],
  viewer: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'],
};

function officerFor(dept: string, email: string): Officer | undefined {
  const m = /^(admin|treasurer|auditor|viewer)@(.+)\.local$/.exec(email.trim().toLowerCase());
  if (!m || m[2] !== dept) return undefined;
  const role = m[1] as Officer['role'];
  const prefix = dept === 'devdept' ? 'DEV' : 'OTH';
  return { id: `USR-${dept}-${role}`, fullName: `${prefix} ${role[0].toUpperCase()}${role.slice(1)}`, email: email.trim().toLowerCase(), role, allowedTabs: ROLE_TABS[role] };
}

const STUDENTS: Student[] = [
  { id: 's1', studentId: 'DEV-2026-0001', fullName: 'Ana Reyes', yearLevel: '1st Year', enrollmentStatus: 'Enrolled' },
  { id: 's2', studentId: 'DEV-2026-0002', fullName: 'Ben Santos', yearLevel: '1st Year', enrollmentStatus: 'Enrolled' },
  { id: 's3', studentId: 'DEV-2026-0003', fullName: 'Carla Cruz', yearLevel: '2nd Year', enrollmentStatus: 'Enrolled' },
  { id: 's4', studentId: 'DEV-2026-0004', fullName: 'Dario Lim', yearLevel: '3rd Year', enrollmentStatus: 'Enrolled' },
  { id: 's5', studentId: 'DEV-2026-0005', fullName: 'Elena Bautista', yearLevel: '4th Year', enrollmentStatus: 'Dropped' },
];

const FEES: FeeItem[] = [
  { id: 'f1', category: 'Membership', name: 'Membership Fee', amountCentavos: 15000, targetFund: 'General Fund' },
  { id: 'f2', category: 'Membership', name: 'Org Shirt', amountCentavos: 35000, targetFund: 'Activity Fund' },
  { id: 'f3', category: 'Event', name: 'Acquaintance Party', amountCentavos: 20000, targetFund: 'Activity Fund' },
];

/** h:m today in Philippine time (UTC+08:00), whatever the device zone. */
const today = (h: number, m: number) => {
  const manila = new Date(Date.now() + 8 * 3600 * 1000);
  return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate(), h - 8, m)).toISOString();
};

type Remit = LedgerEntry & { studentId: string; paymentChannel: string; itemDescription: string };

let LEDGER: (LedgerEntry | Remit)[] = [
  { id: 'l1', kind: 'collection', title: 'Ana Reyes', reference: 'OR-2026-000184', subtitle: 'Membership Fee', amountCentavos: 15000, status: 'Valid', at: today(9, 42) },
  { id: 'l2', kind: 'online-remittance', title: 'Ben Santos', reference: 'GC 7731 0042', subtitle: 'Org Shirt · GCash', amountCentavos: 35000, status: 'Pending Verification', at: today(9, 15), studentId: 'DEV-2026-0002', paymentChannel: 'GCash', itemDescription: 'Org Shirt' },
  { id: 'l3', kind: 'online-remittance', title: 'Dario Lim', reference: 'MY 5520 1187', subtitle: 'Acquaintance Party · Maya', amountCentavos: 20000, status: 'Pending Verification', at: today(8, 51), studentId: 'DEV-2026-0004', paymentChannel: 'Maya', itemDescription: 'Acquaintance Party' },
  { id: 'l4', kind: 'collection', title: 'Carla Cruz', reference: 'OR-2026-000179', subtitle: 'Acquaintance Party', amountCentavos: 20000, status: 'Voided', at: today(8, 30) },
  { id: 'l5', kind: 'cashier-remittance', title: 'DEV Treasurer', reference: 'REM-26-0007', subtitle: 'General Fund · Deposit', amountCentavos: 500000, status: 'Remitted', at: today(8, 5) },
  { id: 'l6', kind: 'penalty', title: 'Ben Santos', reference: 'PEN-26-0012', subtitle: 'General Assembly · 2 hrs late', amountCentavos: 10000, status: 'Unsettled', at: today(7, 40) },
];

const findOrg = (slug: string) => {
  const o = ORGS.find((x) => x.subdomain === slug);
  if (!o) throw new ApiError('This department is not registered in CLEAR.', 'not_found', 404);
  return o;
};

const tokens = new Map<string, Session>();

function authed(s: Session, ...tabs: string[]) {
  const live = tokens.get(s.token);
  if (!live || Date.parse(live.expiresAt) < Date.now()) throw new ApiError('Your session has ended. Sign in again.', 'unauthorized', 401);
  if (!tabs.some((t) => live.officer.allowedTabs.includes(t))) throw new ApiError('Your role can’t use this module.', 'forbidden', 403);
}

const pending = new Map<string, Officer>();

export const mockApi: ClearApi = {
  mode: 'mock',

  async listOrganizations() {
    await wait(250);
    return ORGS;
  },

  async getOrganization(slug) {
    await wait(200);
    return findOrg(slug);
  },

  async lookupClearance(slug, query, session) {
    await wait();
    const org = findOrg(slug);
    const q = query.trim().toLowerCase();
    const s = STUDENTS.find((x) => x.studentId.toLowerCase() === q || `${x.studentId.toLowerCase()}@students.local` === q);
    if (!s) throw new ApiError('No student with that ID or email is on this department’s roster.', 'not_found', 404);
    const hold = s.studentId.endsWith('0002') || s.studentId.endsWith('0004');
    const officerView = !!session && session.org.subdomain === slug && session.officer.allowedTabs.includes('tab-clearance');
    return {
      studentName: s.fullName,
      studentId: s.studentId,
      status: hold ? 'hold' : 'cleared',
      outstandingCentavos: officerView ? (hold ? 70000 : 0) : null,
      qrToken: hold ? null : `https://clear.rupertbulquerin.com/department/${org.subdomain}/clearance?q=${s.studentId}&sig=demo`,
      ay: org.activeAy,
      term: org.activeTerm,
      unpaidItems: hold
        ? [
            { label: 'Org Shirt', amount: 35000, academicYear: org.activeAy, term: org.activeTerm, kind: 'fee' },
            { label: 'Membership Fee', amount: 15000, academicYear: 'A.Y. 2025 - 2026', term: '2nd Sem', kind: 'arrear' },
            { label: 'General Assembly penalty', amount: 20000, kind: 'penalty' },
          ]
        : undefined,
    };
  },

  async listFeeItems(slug) {
    await wait(200);
    findOrg(slug);
    return FEES;
  },

  async submitProof(slug, p) {
    await wait(900);
    findOrg(slug);
    const student = STUDENTS.find((s) => s.studentId.toLowerCase() === p.studentId.trim().toLowerCase());
    if (!student) throw new ApiError('Check your student ID. It must match the department roster.', 'invalid_student', 422);
    const submissionId = `SUB-${Date.now().toString(36).toUpperCase()}`;
    LEDGER = [
      {
        id: submissionId, kind: 'online-remittance', title: student.fullName, reference: p.referenceNumber,
        subtitle: `${p.itemDescription} · ${p.paymentChannel}`, amountCentavos: p.amountCentavos,
        status: 'Pending Verification', at: new Date().toISOString(),
        studentId: student.studentId, paymentChannel: p.paymentChannel, itemDescription: p.itemDescription,
      },
      ...LEDGER,
    ];
    return { submissionId };
  },

  async requestCode(slug, email) {
    await wait(700);
    findOrg(slug);
    const address = email.trim().toLowerCase();
    // Same reply whether or not the email is an officer's.
    const officer = officerFor(slug, address);
    if (officer) pending.set(`${slug}:${officer.email}`, officer);
    return { message: 'If this email belongs to an active officer, a verification code was sent.', sentTo: address };
  },

  async verifyCode(slug, email, code) {
    await wait(600);
    const key = `${slug}:${email.trim().toLowerCase()}`;
    const officer = pending.get(key);
    if (!officer || code !== DEMO_OTP) throw new ApiError('Invalid or expired verification code.', 'invalid_code', 400);
    pending.delete(key);
    const session: Session = {
      token: `demo.${officer.id}.${Date.now()}`,
      officer,
      org: findOrg(slug),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    };
    tokens.set(session.token, session);
    return session;
  },

  async restoreSession(_slug, token) {
    await wait(150);
    const s = tokens.get(token);
    // The mock forgets tokens on reload, like a revoked token on the server.
    if (!s) throw new ApiError('Your session has ended. Sign in again.', 'unauthorized', 401);
    return s;
  },

  async signOut(s) {
    tokens.delete(s.token);
  },

  async getDashboard(s) {
    await wait(300);
    authed(s, 'tab-overview');
    const pendingRows = LEDGER.filter((l) => l.status === 'Pending Verification');
    return {
      ay: s.org.activeAy,
      term: s.org.activeTerm,
      cashOnHandCentavos: 845000,
      safekeepingCentavos: 1500000,
      pendingCentavos: pendingRows.reduce((a, l) => a + l.amountCentavos, 0),
      pendingCount: pendingRows.length,
      outstandingCentavos: 420000,
      outstandingStudents: 18,
      collectionsToday: LEDGER.filter((l) => l.kind === 'collection' && l.status === 'Valid').length,
    };
  },

  async listLedger(s, filter) {
    await wait(300);
    authed(s, 'tab-overview');
    const rows = filter?.status ? LEDGER.filter((l) => l.status === filter.status) : LEDGER;
    return rows.slice(0, filter?.limit ?? 100).map(({ id, kind, title, reference, subtitle, amountCentavos, status, at }) => ({
      id, kind, title, reference, subtitle, amountCentavos, status, at,
    }));
  },

  async listStudents(s, q) {
    await wait(300);
    authed(s, 'tab-students', 'tab-payment');
    const needle = q?.trim().toLowerCase();
    return needle ? STUDENTS.filter((x) => x.fullName.toLowerCase().includes(needle) || x.studentId.toLowerCase().includes(needle)) : STUDENTS;
  },

  async recordPayment(s, p) {
    await wait(800);
    authed(s, 'tab-payment');
    if (LEDGER.some((l) => l.reference.toLowerCase() === p.orNumber.trim().toLowerCase()))
      throw new ApiError('This OR number is already used. Check the receipt booklet.', 'duplicate_or', 409);
    const student = STUDENTS.find((x) => x.id === p.studentId);
    const fee = FEES.find((f) => f.id === p.feeId);
    if (!student || !fee) throw new ApiError('Choose a student and a fee item.', 'invalid', 400);
    const entry: LedgerEntry = {
      id: `l${Date.now()}`, kind: 'collection', title: student.fullName, reference: p.orNumber.trim().toUpperCase(),
      subtitle: fee.name, amountCentavos: p.amountCentavos, status: 'Valid', at: new Date().toISOString(),
    };
    LEDGER = [entry, ...LEDGER];
    return entry;
  },

  async getRemittance(s, id) {
    await wait(300);
    authed(s, 'tab-remittances');
    const r = LEDGER.find((l) => l.id === id && l.kind === 'online-remittance') as Remit | undefined;
    if (!r) throw new ApiError('This remittance no longer exists.', 'not_found', 404);
    return { ...r, studentEmail: `${r.studentId.toLowerCase()}@students.local`, proofDataUrl: null, reviewNotes: null, reviewedBy: null };
  },

  async verifyRemittance(s, id, p) {
    await wait(700);
    authed(s, 'tab-remittances');
    const r = LEDGER.find((l) => l.id === id);
    if (!r) throw new ApiError('This remittance no longer exists.', 'not_found', 404);
    if (r.status !== 'Pending Verification') throw new ApiError('This remittance was already reviewed.', 'conflict', 409);
    const orNumber = p.orNumber.trim().toUpperCase();
    if (LEDGER.some((l) => l.reference.toUpperCase() === orNumber))
      throw new ApiError('This OR number is already used. Check the receipt booklet.', 'duplicate_or', 409);
    LEDGER = LEDGER.map((l) => (l.id === id ? { ...l, status: 'Verified', reference: orNumber } : l));
    return { orNumber };
  },

  async invalidateRemittance(s, id) {
    await wait(600);
    authed(s, 'tab-remittances');
    const r = LEDGER.find((l) => l.id === id);
    if (!r) throw new ApiError('This remittance no longer exists.', 'not_found', 404);
    if (r.status !== 'Pending Verification') throw new ApiError('This remittance was already reviewed.', 'conflict', 409);
    LEDGER = LEDGER.map((l) => (l.id === id ? { ...l, status: 'Invalidated' } : l));
    return { ok: true };
  },
};
