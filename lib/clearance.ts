// /lib/clearance.ts
//
// Student clearance rules shared by the web clearance page and the mobile API:
// the term fee package, the per-student obligation check (package balance,
// standalone dues, unsettled penalties, unliquidated advances) and the
// tenant-bound QR signature. No authorization here; callers decide what to show.

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { money } from '@/lib/utils';

export type TermPackage = { total: number; items: { name: string; rate: number; fund: string }[] };
export type UnpaidItem = { category: string; itemDescription: string; balanceDue: number };

function getClearanceSecret(): string {
  const secret =
    process.env.CLEARANCE_SALT ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'Server configuration error: CLEARANCE_SALT or AUTH_SECRET environment variable is required.'
    );
  }
  return secret;
}

export // F49: the signature is bound to the organization, so a QR issued by one
// department cannot be replayed on another department's verification page.
// The "v2" prefix separates it from the old, tenant-less format.
function generateClearanceSignature(organizationId: string, studentId: string, ay: string, term: string): string {
  const secret = getClearanceSecret();
  const payload = `clearance-v2|${organizationId}|${studentId.trim().toLowerCase()}|${ay.trim()}|${term.trim()}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyClearanceSignature(
  organizationId: string,
  studentId: string,
  ay: string,
  term: string,
  providedSig: string
): boolean {
  try {
    const expectedSig = generateClearanceSignature(organizationId, studentId, ay, term);
    const a = Buffer.from(expectedSig.toLowerCase(), 'utf8');
    const b = Buffer.from(String(providedSig || '').trim().toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isVoidedCollection(c: { paymentType?: unknown; status?: unknown }) {
  const pt = String(c.paymentType || '').toUpperCase();
  const st = String(c.status || '').toUpperCase();
  return pt.includes('VOID') || st.includes('VOID') || st.includes('CANCEL');
}

export function buildTermPackage(collectionSetups: any[], term: string): TermPackage {
  const legacyPkgs: Record<
    string,
    { total: number; items: { name: string; rate: number; fund: string }[] }
  > = {
    '1st Sem': {
      total: 650,
      items: [
        { name: 'JIECEP FCUSC Membership Fee (Student & Institutional)', rate: 250, fund: 'JIECEP Membership Fund' },
        { name: 'General Orientation/Acquaintance Party', rate: 200, fund: 'General Orientation Fund' },
        { name: 'COE FCUSR Activities', rate: 100, fund: 'FCUSR Activities Fund' },
        { name: 'Sports and Cultural Fund', rate: 100, fund: 'Sports & Cultural Fund' },
      ],
    },
    '2nd Sem': {
      total: 900,
      items: [
        { name: 'JIECEP FCUSC Fund', rate: 50, fund: 'JIECEP FCUSC Fund' },
        { name: 'JIECEP Week Activities (Local & Regional)', rate: 150, fund: 'JIECEP Week Activities Fund' },
        { name: 'ECE Grand Ball', rate: 650, fund: 'ECE Grandball Fund' },
        { name: 'Emergency/Calamity Fund', rate: 30, fund: 'Emergency/Calamity Fund' },
        { name: 'FCUSR Activities & Projects', rate: 20, fund: 'FCUSR Activities Fund' },
      ],
    },
    Summer: {
      total: 200,
      items: [
        { name: 'Summer Departmental Operations', rate: 150, fund: 'New Accounts (Current Operations)' },
        { name: 'Special Activities Fund', rate: 50, fund: 'JIECEP Activities Fund' },
      ],
    },
  };

  const pkgItems = collectionSetups.filter((c: any) => c.isPackage !== false);
  if (pkgItems.length > 0) {
    return {
      total: money(pkgItems.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)),
      items: pkgItems.map((s: any) => ({
        name: String(s.name || '').trim(),
        rate: money(s.amount),
        fund: String(s.targetFund || '').trim(),
      })),
    };
  }
  return legacyPkgs[term] || legacyPkgs['1st Sem'];
}

/** Live obligations of one student for a term; an empty list means cleared. */
export function evaluateStudentObligations(
  termPkg: TermPackage,
  student: { id: string; studentId: string; fullName: string },
  collections: any[],
  penalties: any[],
  advances: any[]
): UnpaidItem[] {
  const unpaidItems: { category: string; itemDescription: string; balanceDue: number }[] = [];
  const studentDbIdKey = String(student.id || '').trim().toLowerCase();
  const studentNumKey = String(student.studentId || '').trim().toLowerCase();
  const studentNameKey = String(student.fullName || '').trim().toLowerCase();

  const validCols = collections.filter((c) => !isVoidedCollection(c));

  // 🚀 FIX (F50): Match collections by Student CUID (`student.id`), Student ID Number (`student.studentId`), or Full Name
  const myCollections = validCols.filter((c) => {
    const cStudentId = String(c.studentId || '').trim().toLowerCase();
    const cStudentName = String(c.studentName || '').trim().toLowerCase();
    return (
      (cStudentId && (cStudentId === studentDbIdKey || cStudentId === studentNumKey)) ||
      (cStudentName && cStudentName === studentNameKey)
    );
  });

  const isPackageCollection = (desc: string) => {
    const descLower = desc.toLowerCase();
    return (
      termPkg.items.some((pi: any) => String(pi.name).trim().toLowerCase() === descLower) ||
      descLower.includes('package') ||
      descLower === 'departmental fee'
    );
  };

  const packagePaid = money(
    myCollections
      .filter((c) => isPackageCollection(String(c.itemDescription || '')))
      .reduce((sum, c) => sum + (Number(c.amountPaid) || 0), 0)
  );

  const remainingPkg = money(termPkg.total - packagePaid);
  if (termPkg.total > 0 && remainingPkg > 0) {
    unpaidItems.push({
      category: 'Departmental Fee',
      itemDescription: 'Mandatory Package Balance',
      balanceDue: remainingPkg,
    });
  }

  // Group standalone items accurately by itemDescription
  const standaloneGroups = new Map<
    string,
    { category: string; assessed: number; paid: number; hasDue: boolean }
  >();
  for (const c of myCollections) {
    const desc = String(c.itemDescription || '').trim();
    if (!desc || isPackageCollection(desc)) continue;
    const key = desc.toLowerCase();
    const group = standaloneGroups.get(key) || {
      category: String(c.category || 'Assessment'),
      assessed: 0,
      paid: 0,
      hasDue: false,
    };
    group.assessed = Math.max(group.assessed, money(c.standardRate));
    group.paid = money(group.paid + money(c.amountPaid));
    if (money(c.balanceDue) > 0) group.hasDue = true;
    standaloneGroups.set(key, group);
  }

  standaloneGroups.forEach((group, key) => {
    const rem = money(group.assessed - group.paid);
    if (rem > 0) {
      const displayDesc =
        myCollections.find(
          (c) => String(c.itemDescription || '').trim().toLowerCase() === key
        )?.itemDescription || key;
      unpaidItems.push({
        category: group.category,
        itemDescription: displayDesc,
        balanceDue: rem,
      });
    }
  });

  const myPenalties = penalties.filter((p) => {
    const pSid = String(p.studentId || '').trim().toLowerCase();
    const st = String(p.status || '');
    return (
      (pSid === studentNumKey || pSid === studentDbIdKey) &&
      !st.includes('Settled') &&
      !st.includes('Voided')
    );
  });

  if (myPenalties.length > 0) {
    const totalPen = money(
      myPenalties.reduce((sum, p) => sum + (Number(p.fineAmount) || 0), 0)
    );
    if (totalPen > 0) {
      unpaidItems.push({
        category: 'Penalty',
        itemDescription: 'Unsettled Fine / Arrears',
        balanceDue: totalPen,
      });
    }
  }

  const myAdvances = advances.filter((ca) => {
    const req = String(ca.requestor || '').toLowerCase();
    const st = String(ca.status || '');
    return (
      studentNumKey &&
      req.includes(studentNumKey) &&
      st.includes('Pending') &&
      !st.includes('Cancel') &&
      !st.includes('Liquidated')
    );
  });

  if (myAdvances.length > 0) {
    myAdvances.forEach((ca) =>
      unpaidItems.push({
        category: 'Cash Advance',
        itemDescription: `Unliquidated CA [${ca.advanceId}]`,
        balanceDue: money(ca.amountApproved),
      })
    );
  }

  return unpaidItems;
}

/** Loads the records evaluateStudentObligations needs for one student. */
export async function loadStudentObligationRecords(
  organizationId: string,
  student: { id: string; studentId: string; fullName: string },
  ay: string,
  term: string
) {
  const [collections, penalties, cashAdvances] = await Promise.all([
    prisma.collection.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
        OR: [
          { studentId: student.id },
          { studentId: { equals: student.studentId, mode: 'insensitive' } },
          { studentName: { equals: student.fullName, mode: 'insensitive' } },
        ],
      },
    }),
    prisma.penalty.findMany({
      where: { organizationId, academicYear: ay, term, studentId: { equals: student.studentId, mode: 'insensitive' } },
    }),
    prisma.cashAdvance.findMany({
      where: { organizationId, academicYear: ay, term, requestor: { contains: student.studentId, mode: 'insensitive' } },
    }),
  ]);
  return { collections, penalties, cashAdvances };
}

/**
 * Looks a student up by school ID or email and evaluates their clearance for the
 * term. Returns null when no student matches.
 */
export async function getStudentClearance(organizationId: string, query: string, ay: string, term: string) {
  const q = String(query || '').trim();
  if (!q) return null;
  const student = await prisma.student.findFirst({
    where: {
      organizationId,
      OR: [{ studentId: { equals: q, mode: 'insensitive' } }, { email: { equals: q, mode: 'insensitive' } }],
    },
  });
  if (!student) return null;

  const setups = await prisma.collectionSetup.findMany({ where: { organizationId, academicYear: ay, term } });
  const termPkg = buildTermPackage(setups, term);
  const { collections, penalties, cashAdvances } = await loadStudentObligationRecords(organizationId, student, ay, term);
  const unpaidItems = evaluateStudentObligations(termPkg, student, collections, penalties, cashAdvances);
  const isCleared = unpaidItems.length === 0;
  return {
    student,
    unpaidItems,
    isCleared,
    signature: isCleared ? generateClearanceSignature(organizationId, student.studentId, ay, term) : null,
  };
}

/** Path of the public verification page a clearance QR code points to. */
export function clearanceVerifyPath(subdomain: string, ay: string, term: string, studentId: string, signature: string) {
  return `/department/${encodeURIComponent(subdomain)}/clearance?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&q=${encodeURIComponent(studentId)}&sig=${encodeURIComponent(signature)}`;
}
