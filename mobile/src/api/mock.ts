// In-memory stand-in for the Phase 2 REST API, seeded like prisma/seed-dev.js.
// Every function is async and throws ApiError so screens behave as they will
// against the network.

import {
  ApiError,
  type ClearanceResult, type DashboardSummary, type FeeItem, type LedgerEntry, type Officer,
  type Organization, type ProofSubmission, type Session, type Student,
} from './types';

export const DEMO_OTP = '123456';

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));

const AY = 'A.Y. 2026 - 2027';
const TERM = '1st Sem';

const ORGS: Organization[] = [
  { subdomain: 'devdept', name: 'Dev Department of Engineering', type: 'Department', logoUrl: null, activeAy: AY, activeTerm: TERM },
  { subdomain: 'jiecep', name: 'Junior Institute of Electronics Engineers of the Philippines - FCU Student Chapter', type: 'Organization', logoUrl: null, activeAy: AY, activeTerm: TERM },
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
  return {
    id: `USR-${dept}-${role}`,
    fullName: `${dept === 'devdept' ? 'DEV' : dept.toUpperCase()} ${role[0].toUpperCase()}${role.slice(1)}`,
    email: email.trim().toLowerCase(),
    role,
    allowedTabs: ROLE_TABS[role],
  };
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

const today = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

let LEDGER: LedgerEntry[] = [
  { id: 'l1', kind: 'collection', title: 'Ana Reyes', reference: 'OR-2026-000184', subtitle: 'Membership Fee', amountCentavos: 15000, status: 'Valid', at: today(9, 42) },
  { id: 'l2', kind: 'online-remittance', title: 'Ben Santos', reference: 'GC 7731 0042', subtitle: 'Org Shirt · GCash', amountCentavos: 35000, status: 'Pending Verification', at: today(9, 15) },
  { id: 'l3', kind: 'online-remittance', title: 'Dario Lim', reference: 'MY 5520 1187', subtitle: 'Acquaintance Party · Maya', amountCentavos: 20000, status: 'Pending Verification', at: today(8, 51) },
  { id: 'l4', kind: 'collection', title: 'Carla Cruz', reference: 'OR-2026-000179', subtitle: 'Acquaintance Party', amountCentavos: 20000, status: 'Voided', at: today(8, 30) },
  { id: 'l5', kind: 'cashier-remittance', title: 'DEV Treasurer', reference: 'REM-26-0007', subtitle: 'General Fund · Deposit', amountCentavos: 500000, status: 'Remitted', at: today(8, 5) },
  { id: 'l6', kind: 'penalty', title: 'Ben Santos', reference: 'PEN-26-0012', subtitle: 'General Assembly · 2 hrs late', amountCentavos: 10000, status: 'Unsettled', at: today(7, 40) },
];

// ------------------------------------------------------------------ public
export async function listOrganizations(): Promise<Organization[]> {
  await wait(250);
  return ORGS;
}

export async function getOrganization(subdomain: string): Promise<Organization> {
  await wait(200);
  const org = ORGS.find((o) => o.subdomain === subdomain);
  if (!org) throw new ApiError('This department is not registered in CLEAR.', 'not_found');
  return org;
}

export async function lookupClearance(subdomain: string, query: string): Promise<ClearanceResult> {
  await wait();
  const org = await getOrganization(subdomain);
  const q = query.trim().toLowerCase();
  const s = STUDENTS.find((x) => x.studentId.toLowerCase() === q || `${x.studentId.toLowerCase()}@students.local` === q);
  if (!s) throw new ApiError('No student with that ID or email is on this department’s roster.', 'not_found');
  const hold = s.studentId.endsWith('0002') || s.studentId.endsWith('0004');
  return {
    studentName: s.fullName,
    studentId: s.studentId,
    status: hold ? 'hold' : 'cleared',
    outstandingCentavos: hold ? 70000 : 0,
    qrToken: hold ? null : `CLEAR-DEMO:${org.subdomain}:${s.studentId}:${org.activeAy}:${org.activeTerm}`,
    ay: org.activeAy,
    term: org.activeTerm,
  };
}

export async function listFeeItems(subdomain: string): Promise<FeeItem[]> {
  await getOrganization(subdomain);
  return FEES;
}

export async function submitProof(subdomain: string, p: ProofSubmission): Promise<{ submissionId: string }> {
  await wait(900);
  if (!STUDENTS.some((s) => s.studentId.toLowerCase() === p.studentId.trim().toLowerCase()))
    throw new ApiError('Check your student ID. It must match the department roster.', 'invalid_student');
  const submissionId = `SUB-${Date.now().toString(36).toUpperCase()}`;
  LEDGER = [
    {
      id: submissionId, kind: 'online-remittance', title: STUDENTS.find((s) => s.studentId.toLowerCase() === p.studentId.toLowerCase())!.fullName,
      reference: p.referenceNumber, subtitle: `${p.itemDescription} · ${p.paymentChannel}`, amountCentavos: p.amountCentavos,
      status: 'Pending Verification', at: new Date().toISOString(),
    },
    ...LEDGER,
  ];
  void subdomain;
  return { submissionId };
}

// ------------------------------------------------------------------ auth
const pending = new Map<string, Officer>();

export async function requestCode(subdomain: string, email: string): Promise<{ sentTo: string }> {
  await wait(700);
  const officer = officerFor(subdomain, email);
  if (!officer) throw new ApiError('This email is not an active officer account for this department.', 'not_officer');
  pending.set(`${subdomain}:${officer.email}`, officer);
  return { sentTo: officer.email };
}

export async function verifyCode(subdomain: string, email: string, code: string): Promise<Session> {
  await wait(600);
  const key = `${subdomain}:${email.trim().toLowerCase()}`;
  const officer = pending.get(key);
  if (!officer) throw new ApiError('That code has expired. Request a new one.', 'expired');
  if (code !== DEMO_OTP) throw new ApiError('That code doesn’t match. Check the latest email or resend.', 'mismatch');
  pending.delete(key);
  return {
    token: `demo.${officer.id}`,
    officer,
    org: await getOrganization(subdomain),
    expiresAt: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  };
}

// ------------------------------------------------------------------ officer
function authed(session: Session) {
  if (!session.token || Date.parse(session.expiresAt) < Date.now())
    throw new ApiError('Your session has ended. Sign in again.', 'unauthorized');
}

export async function getDashboard(session: Session): Promise<DashboardSummary> {
  authed(session);
  await wait(300);
  const pendingRows = LEDGER.filter((l) => l.status === 'Pending Verification');
  return {
    cashOnHandCentavos: 845000,
    safekeepingCentavos: 1500000,
    pendingCentavos: pendingRows.reduce((a, l) => a + l.amountCentavos, 0),
    pendingCount: pendingRows.length,
    outstandingCentavos: 420000,
    outstandingStudents: 18,
    collectionsToday: LEDGER.filter((l) => l.kind === 'collection' && l.status === 'Valid').length,
  };
}

export async function listLedger(session: Session, filter?: { status?: string }): Promise<LedgerEntry[]> {
  authed(session);
  await wait(300);
  return filter?.status ? LEDGER.filter((l) => l.status === filter.status) : LEDGER;
}

export async function reviewRemittance(session: Session, id: string, decision: 'verify' | 'invalidate'): Promise<{ orNumber?: string }> {
  await wait(700);
  const orNumber = decision === 'verify' ? `OR-2026-000${185 + Math.floor(Math.random() * 10)}` : undefined;
  LEDGER = LEDGER.map((l) =>
    l.id === id ? { ...l, status: decision === 'verify' ? 'Verified' : 'Invalidated', reference: orNumber ?? l.reference } : l
  );
  return { orNumber };
}

export async function listStudents(session: Session): Promise<Student[]> {
  authed(session);
  authed(session);
  await wait(300);
  return STUDENTS;
}

export async function recordPayment(
  session: Session,
  p: { studentId: string; feeId: string; amountCentavos: number; orNumber: string }
): Promise<LedgerEntry> {
  authed(session);
  await wait(800);
  if (LEDGER.some((l) => l.reference.toLowerCase() === p.orNumber.trim().toLowerCase()))
    throw new ApiError('This OR number is already used. Check the receipt booklet.', 'duplicate_or');
  const student = STUDENTS.find((s) => s.id === p.studentId);
  const fee = FEES.find((f) => f.id === p.feeId);
  if (!student || !fee) throw new ApiError('Choose a student and a fee item.', 'invalid');
  const entry: LedgerEntry = {
    id: `l${Date.now()}`, kind: 'collection', title: student.fullName, reference: p.orNumber.trim().toUpperCase(),
    subtitle: fee.name, amountCentavos: p.amountCentavos, status: 'Valid', at: new Date().toISOString(),
  };
  LEDGER = [entry, ...LEDGER];
  return entry;
}
