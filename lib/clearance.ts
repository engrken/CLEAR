/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors Ken's code line for line (including his loose types) so it stays easy to re-sync */
// /lib/clearance.ts
//
// Student clearance for the mobile API. Ken's rules live inside the page closure
// of app/department/[department]/clearance/page.tsx (tied to next-auth auth()), so
// they are MIRRORED here; each block names the source it copies. Reused as-is:
// listHistoricalDebts (lib/student-arrears.ts), decodeStudentDue /
// activeCollectibleDue (collectibles/due-link.ts).
//
// One deliberate difference from Ken's page: his penalty filter (~286-295) drops any
// penalty whose upper-cased status *contains* "SETTLED", which also drops
// "Unsettled", so unsettled penalties never block clearance there. Here only
// statuses that START with SETTLED count as settled, the same rule his arrears code
// uses (/^SETTLED/i in lib/student-arrears.ts) and his payment code checks.
//
// No authorization here; callers decide what to show.

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { money } from '@/lib/utils';
import { listHistoricalDebts, type HistoricalDebt } from '@/lib/student-arrears';
import {
  activeCollectibleDue,
  decodeStudentDue,
} from '@/app/department/[department]/(protected)/collectibles/due-link';

export type TermPackage = { total: number; items: { name: string; rate: number; fund: string }[] };

/** Ken's unpaid-item shape plus optional origin period (previous-period arrears only). */
export type UnpaidItem = {
  category: string;
  itemDescription: string;
  balanceDue: number;
  originAy?: string;
  originTerm?: string;
};

// ---------------------------------------------------------------- QR signature
// Mirrors getClearanceSecret / generateClearanceSignature / verifyClearanceSignature
// in app/department/[department]/clearance/page.tsx (~40-75). The payload format
// must stay byte-identical so a QR issued by the app verifies on Ken's web page.

export const CLEARANCE_SIGNATURE_PREFIX = 'CLEAR-V2';

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

export function generateClearanceSignature(orgId: string, studentId: string, ay: string, term: string): string {
  const secret = getClearanceSecret();
  const payload = `${CLEARANCE_SIGNATURE_PREFIX}|${orgId}|${studentId.trim().toLowerCase()}|${ay.trim()}|${term.trim()}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyClearanceSignature(
  orgId: string,
  studentId: string,
  ay: string,
  term: string,
  providedSig: string
): boolean {
  try {
    const expectedSig = generateClearanceSignature(orgId, studentId, ay, term);
    const a = Buffer.from(expectedSig.toLowerCase(), 'utf8');
    const b = Buffer.from(String(providedSig || '').trim().toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- rules

/** Mirrors isVoidedCollection in clearance/page.tsx (~86-90). */
export function isVoidedCollection(c: { paymentType?: unknown; status?: unknown }) {
  const pt = String(c.paymentType || '').toUpperCase();
  const st = String(c.status || '').toUpperCase();
  return pt.includes('VOID') || st.includes('VOID') || st.includes('CANCEL');
}

/**
 * Mirrors buildTermPackage in clearance/page.tsx (~92-104): the package is exactly
 * the org's setups marked isPackage === true; no institution-specific fallback.
 */
export function buildTermPackage(collectionSetups: any[], _term?: string): TermPackage {
  const pkgItems = collectionSetups.filter((c) => c.isPackage === true);
  return {
    total: money(pkgItems.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0)),
    items: pkgItems.map((c: any) => ({
      name: String(c.name || '').trim(),
      rate: money(c.amount),
      fund: String(c.targetFund || '').trim(),
    })),
  };
}

/** Penalty statuses that no longer owe anything. See the header note on Ken's bug. */
export function isClosedPenaltyStatus(status: unknown) {
  const st = String(status || '').trim().toUpperCase();
  return st.startsWith('SETTLED') || st.includes('VOID') || st.includes('CANCEL');
}

/**
 * Live obligations of one student for a term; an empty list means cleared.
 * Mirrors the evaluateStudentObligations closure in clearance/page.tsx (~202-362).
 * `historicalDebts` may hold every student's debts; only this student's are used
 * (Ken keys them by debt.studentId, lower-cased, against the school ID).
 */
export function evaluateStudentObligations(
  termPkg: TermPackage,
  student: { id: string; studentId: string; fullName: string },
  collections: any[],
  penalties: any[],
  advances: any[],
  collectibles: any[] = [],
  historicalDebts: HistoricalDebt[] = []
): UnpaidItem[] {
  const unpaidItems: UnpaidItem[] = [];
  const studentDbIdKey = String(student.id || '').trim().toLowerCase();
  const studentNumKey = String(student.studentId || '').trim().toLowerCase();
  const studentNameKey = String(student.fullName || '').trim().toLowerCase();

  const validCols = collections.filter((c) => !isVoidedCollection(c));

  // F50: match collections by student CUID, school ID or full name.
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
      termPkg.items.some((pi) => String(pi.name).trim().toLowerCase() === descLower) ||
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

  // Standalone items grouped by itemDescription; arrears receipts are skipped.
  const standaloneGroups = new Map<string, { category: string; assessed: number; paid: number; hasDue: boolean }>();
  for (const c of myCollections) {
    const desc = String(c.itemDescription || '').trim();
    if (!desc || isPackageCollection(desc) || /^Historical (Penalty|Collectible) \[/i.test(desc)) continue;
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
        myCollections.find((c) => String(c.itemDescription || '').trim().toLowerCase() === key)?.itemDescription || key;
      unpaidItems.push({ category: group.category, itemDescription: displayDesc, balanceDue: rem });
    }
  });

  // DIFFERENCE FROM KEN (~286-295): only /^SETTLED/ counts as settled (see header).
  const myPenalties = penalties.filter((p) => {
    const pSid = String(p.studentId || '').trim().toLowerCase();
    return (pSid === studentNumKey || pSid === studentDbIdKey) && !isClosedPenaltyStatus(p.status);
  });

  if (myPenalties.length > 0) {
    const totalPen = money(myPenalties.reduce((sum, p) => sum + (Number(p.fineAmount) || 0), 0));
    if (totalPen > 0) {
      unpaidItems.push({ category: 'Penalty', itemDescription: 'Unsettled Fine / Arrears', balanceDue: totalPen });
    }
  }

  const myAdvances = advances.filter((ca) => {
    const req = String(ca.requestor || '').toLowerCase();
    const st = String(ca.status || '').toUpperCase();
    return (
      studentNumKey &&
      req.includes(studentNumKey) &&
      (st.includes('PENDING') || st.includes('UNLIQUIDATED')) &&
      !st.includes('CANCEL') &&
      !st.includes('VOID') &&
      !st.includes('LIQUIDATED')
    );
  });

  myAdvances.forEach((ca) =>
    unpaidItems.push({
      category: 'Cash Advance',
      itemDescription: `Unliquidated CA [${ca.advanceId}]`,
      balanceDue: money(ca.amountApproved),
    })
  );

  const myCollectibles = collectibles.filter((due) => {
    if (!activeCollectibleDue(due)) return false;
    const marker = decodeStudentDue(due.status);
    return marker && marker.studentId.toLowerCase() === studentNumKey;
  });
  for (const due of myCollectibles) {
    const marker = decodeStudentDue(due.status);
    if (!marker) continue;
    // The linked collectible's balance replaces an item-level remainder of the same name.
    const existing = unpaidItems.findIndex(
      (u) => u.itemDescription.trim().toLowerCase() === marker.itemDescription.trim().toLowerCase()
    );
    if (existing >= 0) unpaidItems.splice(existing, 1);
    unpaidItems.push({
      category: String(due.category || 'Collectible'),
      itemDescription: marker.itemDescription,
      balanceDue: money(due.balanceDue),
    });
  }

  // Previous-period penalties and collectibles survive rollover.
  for (const debt of historicalDebts) {
    if (debt.studentId.trim().toLowerCase() !== studentNumKey) continue;
    unpaidItems.push({
      category: `${debt.category} — Previous Period`,
      itemDescription: `${debt.itemDescription} (${debt.originTerm}, ${debt.originAY})`,
      balanceDue: money(debt.balanceDue),
      originAy: debt.originAY,
      originTerm: debt.originTerm,
    });
  }
  return unpaidItems;
}

/**
 * listHistoricalDebts (lib/student-arrears.ts) for one student. It throws when any
 * academic year it compares is malformed (academicYearStart); then arrears are
 * left out rather than failing the whole lookup.
 */
export async function loadHistoricalDebts(organizationId: string, ay: string, term: string, studentId?: string) {
  try {
    return await listHistoricalDebts(prisma, organizationId, ay, term, studentId);
  } catch (err) {
    console.error('[clearance] previous-period arrears could not be evaluated:', err);
    return [];
  }
}

/**
 * Loads the records evaluateStudentObligations needs for one student; the queries
 * mirror the public/verify views of clearance/page.tsx (~383-413, ~668-698).
 * Penalties also match the student's database id, as the in-memory filter does.
 */
export async function loadStudentObligationRecords(
  organizationId: string,
  student: { id: string; studentId: string; fullName: string },
  ay: string,
  term: string
) {
  const [collections, penalties, cashAdvances, collectibles, historicalDebts] = await Promise.all([
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
      where: {
        organizationId,
        academicYear: ay,
        term,
        OR: [{ studentId: { equals: student.studentId, mode: 'insensitive' } }, { studentId: student.id }],
      },
    }),
    prisma.cashAdvance.findMany({
      where: { organizationId, academicYear: ay, term, requestor: { contains: student.studentId, mode: 'insensitive' } },
    }),
    prisma.collectible.findMany({ where: { organizationId, academicYear: ay, term } }),
    loadHistoricalDebts(organizationId, ay, term, student.studentId),
  ]);
  return { collections, penalties, cashAdvances, collectibles, historicalDebts };
}

/**
 * Looks a student up by school ID or email (as Ken's public portal, ~657-665) and
 * evaluates their clearance for the term. Returns null when no student matches.
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

  const setups = await prisma.collectionSetup.findMany({
    where: { organizationId, academicYear: ay, term },
    orderBy: { name: 'asc' },
  });
  const termPkg = buildTermPackage(setups, term);
  const records = await loadStudentObligationRecords(organizationId, student, ay, term);
  const unpaidItems = evaluateStudentObligations(
    termPkg,
    student,
    records.collections,
    records.penalties,
    records.cashAdvances,
    records.collectibles,
    records.historicalDebts
  );
  const isCleared = unpaidItems.length === 0;
  return {
    student,
    unpaidItems,
    isCleared,
    signature: isCleared ? generateClearanceSignature(organizationId, student.studentId, ay, term) : null,
  };
}

/** Path of Ken's verification page a clearance QR code points to (same query as his ~712). */
export function clearanceVerifyPath(subdomain: string, ay: string, term: string, studentId: string, signature: string) {
  return `/department/${encodeURIComponent(subdomain)}/clearance?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}&q=${encodeURIComponent(studentId)}&sig=${encodeURIComponent(signature)}`;
}
