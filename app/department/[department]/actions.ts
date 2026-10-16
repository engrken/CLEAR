// /app/department/[department]/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';
import { requireTabAccess, isSuperAdminEmail } from '@/lib/permissions';
import { money as roundMoney } from '@/lib/utils';

// =========================================================================
// GENERAL HELPERS
// =========================================================================

function normalizeDepartment(dept: string) {
  const clean = decodeURIComponent(String(dept || '')).trim().toLowerCase();
  if (!clean) throw new Error('Department is required.');
  return clean;
}

function money(val: unknown, field = 'Amount') {
  const amt = Number(val);
  if (!Number.isFinite(amt)) throw new Error(`${field} must be a valid number.`);
  if (amt < 0) throw new Error(`${field} cannot be negative.`);
  return roundMoney(amt);
}

function isVoidedRecord(row: { paymentType?: unknown; status?: unknown }) {
  const pt = String(row.paymentType || '').toUpperCase();
  const st = String(row.status || '').toUpperCase();
  return pt.includes('VOID') || st.includes('VOID') || st.includes('CANCEL');
}

function getStudentKey(dbId?: unknown, name?: unknown, fallback = '') {
  const id = String(dbId || '').trim().toLowerCase();
  const n = String(name || '').trim().toLowerCase();
  return id ? `ID:${id}` : n ? `NAME:${n}` : fallback;
}

function normalizeItemKey(val: unknown) {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// =========================================================================
// ORGANIZATION / TENANT GUARDS
// =========================================================================

async function resolveOrganizationId(department: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: normalizeDepartment(department) },
    select: { id: true },
  });
  if (!org) throw new Error('Department organization not found.');
  return org.id;
}

async function requireOrganizationAccess(organizationId: string) {
  const session = await auth();
  const sessionUser = session?.user as {
    id?: string;
    name?: string | null;
    fullName?: string | null;
    email?: string | null;
    role?: string | null;
    organizationId?: string | null;
  } | undefined;

  const email = String(sessionUser?.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('401 Unauthorized: Session expired or missing email.');
  }

  // Allow SuperAdmin global inspection access. Only the configured Super Admin
  // email qualifies: a tenant role string such as "master" must never grant
  // cross-tenant access.
  if (isSuperAdminEmail(email)) {
    return {
      id: sessionUser?.id || 'superadmin',
      organizationId,
      fullName: sessionUser?.name || sessionUser?.fullName || 'Super Admin',
      email,
      role: 'SuperAdmin',
      status: 'Active',
    };
  }

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId,
      email: { equals: email, mode: 'insensitive' },
      status: 'Active',
    },
  });

  if (!user) {
    throw new Error('403 Forbidden: You do not have access to this department.');
  }

  return user;
}

async function getOrgId(department: string) {
  const orgId = await resolveOrganizationId(department);
  await requireOrganizationAccess(orgId);
  return orgId;
}

// 🚀 SECURITY FIX (F39): Read NextAuth's `name` property first so logs show officer's name instead of email
async function getActionUser(): Promise<string> {
  const user = (await auth())?.user as {
    name?: string | null;
    fullName?: string | null;
    email?: string | null;
  } | undefined;
  return user?.name || user?.fullName || user?.email || 'System';
}

// =========================================================================
// SIGNATORIES CONFIGURATION
// =========================================================================

// 🚀 SECURITY FIX (F29 & F27): Enforce tab access, derive orgId server-side, and log action
export async function saveSignatories(_clientOrgId: string, department: string, signatories: any[]) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-report', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);

  const sanitized = (Array.isArray(signatories) ? signatories : [])
    .map((sig, order) => ({
      organizationId: orgId,
      label: String(sig?.label || '').trim(),
      name: String(sig?.name || '').trim(),
      position: String(sig?.position || '').trim(),
      order,
    }))
    .filter((s) => s.label || s.name || s.position);

  await prisma.$transaction(async (tx) => {
    await tx.signatory.deleteMany({ where: { organizationId: orgId } });
    if (sanitized.length > 0) {
      await tx.signatory.createMany({ data: sanitized });
    }
  });

  await logSystemAction(
    orgId,
    officerName,
    'UPDATE_SIGNATORIES',
    `Updated ${sanitized.length} report signatory block(s).`
  );

  revalidatePath(`/department/${cleanDept}/summary`);
  revalidatePath(`/department/${cleanDept}/liquidations`);
  return { success: true };
}

// =========================================================================
// COLLECTION
// =========================================================================

async function validateStudentOwnership(
  tx: { student: typeof prisma.student },
  organizationId: string,
  studentDbId?: string | null
) {
  const id = String(studentDbId || '').trim();
  if (!id) return null;
  const student = await tx.student.findFirst({
    where: { id, organizationId },
    select: { id: true, studentId: true, fullName: true, email: true },
  });
  if (!student) {
    throw new Error('Selected student does not belong to this department.');
  }
  return student;
}

async function getPreviouslyPaid(
  tx: { collection: typeof prisma.collection },
  organizationId: string,
  studentId: string | null | undefined,
  studentName: string,
  academicYear: string,
  term: string,
  itemDesc: string
) {
  if (!String(itemDesc || '').trim()) return 0;
  const rows = await tx.collection.findMany({
    where: {
      organizationId,
      academicYear,
      term,
      itemDescription: String(itemDesc).trim(),
      ...(studentId
        ? { studentId }
        : { studentId: null, studentName: String(studentName || '').trim() }),
    },
    select: { amountPaid: true, paymentType: true, status: true },
  });
  return roundMoney(
    rows
      .filter((r) => !isVoidedRecord(r))
      .reduce((s, r) => s + (Number(r.amountPaid) || 0), 0)
  );
}

// 🚀 SECURITY FIX (F38): Wrap balance check and insert inside an atomic transaction
export async function recordCollection(department: string, data: any) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-payment', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);

  const studentDbId = String(data.studentId || '').trim() || null;
  const paid = money(data.amountPaid, 'Payment');
  const rate = money(data.standardRate, 'Rate');
  const itemDesc = String(data.itemDescription || '').trim();
  const orNumber = String(data.orNumber || '').trim();
  const studentName = String(data.studentName || '').trim();

  if (paid <= 0 || rate <= 0 || !itemDesc || !orNumber || !studentName) {
    throw new Error(
      'Valid OR number, student name, payment amount, standard rate, and item description are required.'
    );
  }

  await prisma.$transaction(async (tx) => {
    await validateStudentOwnership(tx, orgId, studentDbId);

    const alreadyPaid = await getPreviouslyPaid(
      tx,
      orgId,
      studentDbId,
      studentName,
      data.ay,
      data.term,
      itemDesc
    );
    const remaining = Math.max(0, roundMoney(rate - alreadyPaid));

    if (remaining <= 0) {
      throw new Error(
        `This assessment has already been fully paid at ₱${rate.toFixed(2)}.`
      );
    }
    if (paid > remaining) {
      throw new Error(
        `Payment ₱${paid.toFixed(2)} exceeds remaining balance of ₱${remaining.toFixed(2)}.`
      );
    }

    const balanceDue = Math.max(0, roundMoney(rate - (alreadyPaid + paid)));

    await tx.collection.create({
      data: {
        organizationId: orgId,
        academicYear: data.ay,
        term: data.term,
        orNumber,
        studentId: studentDbId,
        studentName,
        category: String(data.category || '').trim(),
        itemDescription: itemDesc,
        paymentType:
          balanceDue === 0
            ? 'Full Payment'
            : String(data.paymentType || '').trim() || 'Partial Payment',
        standardRate: rate,
        amountPaid: paid,
        balanceDue,
        fundAllocation: String(data.fundAllocation || '').trim(),
        status: 'Valid',
        encodedBy: officerName,
      },
    });
  });

  await logSystemAction(
    orgId,
    officerName,
    'RECORD_COLLECTION',
    `Collected ₱${paid.toFixed(2)} from ${studentName} for ${itemDesc} [OR: ${orNumber}].`
  );

  revalidatePath(`/department/${cleanDept}/collections`);
  revalidatePath(`/department/${cleanDept}/clearance`);
  revalidatePath(`/department/${cleanDept}`);
}

// =========================================================================
// STUDENTS, TRANSFERS & PROFILE
// =========================================================================

export async function upsertStudent(
  department: string,
  data: { studentId: string; fullName: string; email: string }
) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-students', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);
  const sId = String(data.studentId || '').trim();
  const name = String(data.fullName || '').trim();
  const email = String(data.email || '').trim() || null;

  if (!sId || !name) throw new Error('Student ID and name are required.');

  const existing = await prisma.student.findFirst({
    where: { organizationId: orgId, studentId: sId },
  });

  if (existing) {
    await prisma.student.update({
      where: { id: existing.id },
      data: { fullName: name, email },
    });
  } else {
    await prisma.student.create({
      data: {
        organizationId: orgId,
        studentId: sId,
        fullName: name,
        email,
        yearLevel: 'N/A',
      },
    });
  }

  await logSystemAction(
    orgId,
    officerName,
    existing ? 'UPDATE_STUDENT' : 'ADD_STUDENT',
    `${existing ? 'Modified' : 'Registered'} profile for ${name} (${sId}).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  revalidatePath(`/department/${cleanDept}/clearance`);
}

// 🚀 SECURITY FIX (F23): Unlink collections (`studentId: null`) before deleting student so financial receipts are never cascaded/wiped
export async function deleteStudent(department: string, studentId: string) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-students', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);
  const sId = String(studentId || '').trim();
  if (!sId) throw new Error('Student ID is required.');

  const existing = await prisma.student.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ studentId: sId }, { id: sId }],
    },
  });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      // Preserve financial collections by detaching the foreign key before student removal
      await tx.collection.updateMany({
        where: { organizationId: orgId, studentId: existing.id },
        data: { studentId: null },
      });
      await tx.enrollment.deleteMany({
        where: { organizationId: orgId, studentId: existing.id },
      });
      await tx.student.delete({
        where: { id: existing.id },
      });
    });

    await logSystemAction(
      orgId,
      officerName,
      'DELETE_STUDENT',
      `Removed student record for ${existing.fullName} (${existing.studentId}) while preserving historical financial receipts.`
    );
  }

  revalidatePath(`/department/${cleanDept}/students`);
  revalidatePath(`/department/${cleanDept}/clearance`);
}

export async function transferFunds(
  department: string,
  data: {
    fromFund: string;
    toFund: string;
    amount: number;
    reason: string;
    ay: string;
    term: string;
  }
) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-transfer', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);
  const from = String(data.fromFund || '').trim();
  const to = String(data.toFund || '').trim();
  const amt = money(data.amount, 'Transfer amount');

  if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
    throw new Error('Source and destination funds must be distinct and provided.');
  }
  if (amt <= 0) throw new Error('Transfer amount must be greater than zero.');

  await prisma.fundTransfer.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      sourceFund: from,
      destinationFund: to,
      amount: amt,
      reason: String(data.reason || '').trim(),
      encodedBy: officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    'TRANSFER_FUNDS',
    `Realigned ₱${amt.toFixed(2)} from ${from} to ${to}.`
  );

  revalidatePath(`/department/${cleanDept}/realign`);
  revalidatePath(`/department/${cleanDept}`);
}

// 🚀 SECURITY FIX (F32 & F27): Strict email format validation and audit logging
export async function updateMyEmail(department: string, newEmail: string) {
  const cleanDept = normalizeDepartment(department);
  const sessionUser = (await auth())?.user as { email?: string } | undefined;
  if (!sessionUser?.email) {
    throw new Error('Unauthorized: No active session found.');
  }

  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);
  const currentEmail = sessionUser.email.trim().toLowerCase();
  const cleanNewEmail = String(newEmail || '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
    throw new Error('Please provide a valid email address.');
  }

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: { equals: currentEmail, mode: 'insensitive' },
    },
  });
  if (!user) throw new Error('User record not found in this department.');

  const existing = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: { equals: cleanNewEmail, mode: 'insensitive' },
    },
  });
  if (existing && existing.id !== user.id) {
    throw new Error('This email is already registered by another account.');
  }

  await prisma.tenantUser.update({
    where: { id: user.id },
    data: { email: cleanNewEmail },
  });

  await logSystemAction(
    orgId,
    officerName,
    'UPDATE_PROFILE_EMAIL',
    `Updated officer email from ${currentEmail} to ${cleanNewEmail}.`
  );

  revalidatePath(`/department/${cleanDept}`);
  return {
    success: true,
    message: 'Email updated! Please sign out and back in.',
  };
}

// =========================================================================
// FINANCIAL ENGINE
// =========================================================================

// 🚀 SECURITY FIX (F30, F22, F43): Removed `isPublic` auth bypass, enforced centavo rounding, and exposed initialAllocation & netTransfers
export async function getDepartmentFinancials(
  organizationId: string,
  ay: string,
  term: string
) {
  await requireOrganizationAccess(organizationId);

  const [
    collections,
    audits,
    cashAdvances,
    explicitCollectibles,
    initialFunds,
    students,
    enrollments,
    collectionSetups,
    fundTransfers,
    cashierRecords,
  ] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId, academicYear: ay, term },
      include: { student: { select: { id: true, studentId: true, fullName: true } } },
    }),
    prisma.audit.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.cashAdvance.findMany({
      where: { organizationId, academicYear: ay, term },
      orderBy: { dateIssued: 'desc' },
    }),
    prisma.collectible.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.fund.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.student.findMany({ where: { organizationId } }),
    prisma.enrollment.findMany({
      where: { organizationId, academicYear: ay, term },
      include: { student: { select: { id: true, studentId: true, fullName: true } } },
    }),
    prisma.collectionSetup.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.fundTransfer.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.cashierRemittance.findMany({
      where: { organizationId, academicYear: ay, term, status: 'Remitted' },
    }),
  ]);

  // 1. SAFEKEEPING MATH
  const totalDeposited = roundMoney(
    cashierRecords
      .filter((r) => r.type === 'Deposit')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  );
  const totalWithdrawn = roundMoney(
    cashierRecords
      .filter((r) => r.type === 'Withdrawal')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  );
  const cashierBalance = roundMoney(totalDeposited - totalWithdrawn);

  // 2. VALIDATION & HELPERS
  const validCollections = collections.filter((c: any) => !isVoidedRecord(c));
  const validAudits = audits.filter(
    (a: any) => !String(a.status || '').toUpperCase().match(/VOID|CANCEL/)
  );
  const getFundName = (row: any) =>
    [row.fundAllocation, row.fundSource, row.fundName, row.fund].find(
      (f) => f && String(f).trim() !== 'undefined' && String(f).trim() !== 'null'
    ) || 'General Fund (Carried Over)';

  // 3. PACKAGES
  const legacyPkgs: any = {
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
  const termPkg =
    pkgItems.length > 0
      ? {
          total: roundMoney(pkgItems.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)),
          items: pkgItems.map((s: any) => ({
            name: String(s.name || '').trim(),
            rate: roundMoney(s.amount),
            fund: String(s.targetFund || '').trim(),
          })),
        }
      : legacyPkgs[term] || legacyPkgs['1st Sem'];

  // 4. COLLECTIONS & MATCHING
  let grandCollectionTotal = 0;
  const collectionHierarchy: Record<string, { count: number; total: number }> = {};
  const distinctStudents: Record<string, Set<string>> = {};
  const collectionsByFund: Record<string, number> = {};

  const paidByDbStudentId: Record<string, number> = {};
  const paidByStudentNumber: Record<string, number> = {};
  const paidByUniqueStudentName: Record<string, number> = {};

  const studentsByDbId = new Map(students.map((s: any) => [String(s.id).toLowerCase(), s]));
  const studentsByStudentNumber = new Map(
    students.filter((s: any) => s.studentId).map((s: any) => [String(s.studentId).toLowerCase(), s])
  );
  const studentNameCounts = new Map<string, number>();

  students.forEach((s: any) => {
    const name = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (name) studentNameCounts.set(name, (studentNameCounts.get(name) || 0) + 1);
  });

  const addCollectionItem = (name: string, amt: number, key: string, fund: string) => {
    grandCollectionTotal = roundMoney(grandCollectionTotal + amt);
    collectionsByFund[fund] = roundMoney((collectionsByFund[fund] || 0) + amt);
    if (!collectionHierarchy[name]) {
      collectionHierarchy[name] = { count: 0, total: 0 };
      distinctStudents[name] = new Set();
    }
    collectionHierarchy[name].total = roundMoney(collectionHierarchy[name].total + amt);
    if (amt > 0 && key) distinctStudents[name].add(key);
  };

  const obligationGroups = new Map<string, any>();

  validCollections.forEach((c: any) => {
    const desc = String(c.itemDescription || c.category || 'General').trim();
    const descLower = desc.toLowerCase();
    const amt = roundMoney(c.amountPaid);
    const fund = getFundName(c);
    const studentKey = getStudentKey(
      c.studentId || c.student?.id,
      c.student?.fullName || c.studentName,
      String(c.orNumber || '').trim().toLowerCase()
    );

    const matchedPkgItem = termPkg.items.find(
      (pi: any) => String(pi.name).trim().toLowerCase() === descLower
    );
    const isDepPkg = [
      'departmental fee package',
      'departmental fee',
      'departmental fee package (all items)',
    ].includes(descLower);

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey, matchedPkgItem.fund);
    } else if (isDepPkg) {
      const pkgTotalRate = Number(termPkg.total) || 0;
      if (pkgTotalRate > 0) {
        termPkg.items.forEach((pi: any) =>
          addCollectionItem(pi.name, (Number(pi.rate) / pkgTotalRate) * amt, studentKey, pi.fund)
        );
      } else {
        addCollectionItem(desc, amt, studentKey, fund);
      }
    } else {
      addCollectionItem(desc, amt, studentKey, fund);
    }

    if ((matchedPkgItem || isDepPkg) && amt > 0) {
      const relId = String(c.student?.id || '').toLowerCase();
      const rawRef = String(c.studentId || '').toLowerCase();
      const uniqueName = String(c.student?.fullName || c.studentName || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      if (relId && studentsByDbId.has(relId)) {
        paidByDbStudentId[relId] = roundMoney((paidByDbStudentId[relId] || 0) + amt);
      } else if (rawRef && studentsByDbId.has(rawRef)) {
        paidByDbStudentId[rawRef] = roundMoney((paidByDbStudentId[rawRef] || 0) + amt);
      } else if (rawRef && studentsByStudentNumber.has(rawRef)) {
        paidByStudentNumber[rawRef] = roundMoney((paidByStudentNumber[rawRef] || 0) + amt);
      } else if (uniqueName && studentNameCounts.get(uniqueName) === 1) {
        paidByUniqueStudentName[uniqueName] = roundMoney(
          (paidByUniqueStudentName[uniqueName] || 0) + amt
        );
      }
    }

    if (!matchedPkgItem && !isDepPkg) {
      const itemName = desc || String(c.category || '').trim() || 'Other Due';
      const groupKey = `${studentKey}|${itemName.trim().toLowerCase()}`;
      const existing = obligationGroups.get(groupKey) || {
        studentKey,
        itemName,
        assessedAmount: 0,
        paidAmount: 0,
        hasOutstandingMarker: false,
      };
      existing.assessedAmount = Math.max(existing.assessedAmount, roundMoney(c.standardRate));
      existing.paidAmount = roundMoney(existing.paidAmount + amt);
      existing.hasOutstandingMarker =
        existing.hasOutstandingMarker ||
        Number(c.balanceDue) > 0 ||
        String(c.paymentType).toLowerCase().includes('unpaid') ||
        String(c.orNumber).toUpperCase().startsWith('DUE-');
      obligationGroups.set(groupKey, existing);
    }
  });

  Object.keys(collectionHierarchy).forEach(
    (key) => (collectionHierarchy[key].count = distinctStudents[key]?.size || 0)
  );

  // 5. EXPENSES & ADVANCES
  const expensesByFund: Record<string, number> = {};
  const grandExpenseTotal = roundMoney(
    validAudits.reduce((sum, a: any) => {
      const amt = roundMoney(a.totalExpense);
      const fund = getFundName(a);
      expensesByFund[fund] = roundMoney((expensesByFund[fund] || 0) + amt);
      return sum + amt;
    }, 0)
  );

  let totalUnliquidated = 0;
  const unliquidatedByFund: Record<string, number> = {};
  const unliquidatedAdvances = cashAdvances
    .filter((ca: any) => {
      const status = String(ca.status || '').toUpperCase();
      return (
        (status.includes('PENDING') || status.includes('UNLIQUIDATED') || status === 'ACTIVE') &&
        !status.includes('CANCEL') &&
        !status.includes('LIQUIDATED')
      );
    })
    .map((ca: any) => {
      const amt = roundMoney(ca.amountApproved);
      const fund = getFundName(ca);
      totalUnliquidated = roundMoney(totalUnliquidated + amt);
      unliquidatedByFund[fund] = roundMoney((unliquidatedByFund[fund] || 0) + amt);
      return {
        id: ca.advanceId,
        advanceId: ca.advanceId,
        date: ca.dateIssued ? new Date(ca.dateIssued).toISOString().split('T')[0] : '',
        requestor: ca.requestor,
        fund,
        amount: amt,
        amountApproved: amt,
        due: ca.expectedReturnDate
          ? new Date(ca.expectedReturnDate).toISOString().split('T')[0]
          : '',
        status: ca.status,
      };
    });

  // 6. COLLECTIBLES
  const collectiblesMap: Record<string, { category: string; headcount: number; total: number }> = {};
  let totalPackageReceivable = 0;
  let unpaidOrPartialPackageCount = 0;

  const packageStudentMap = new Map(students.map((s: any) => [String(s.id), s]));
  enrollments
    .filter(
      (e: any) =>
        !['DROPPED', 'CANCELLED', 'INACTIVE'].includes(String(e.enrollmentStatus || '').toUpperCase())
    )
    .forEach((e: any) => e.student?.id && packageStudentMap.set(String(e.student.id), e.student));

  Array.from(packageStudentMap.values()).forEach((s: any) => {
    if (!s?.id) return;
    const dbId = String(s.id).toLowerCase();
    const sNum = String(s.studentId || '').toLowerCase();
    const sName = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const remitted =
      paidByDbStudentId[dbId] ??
      paidByStudentNumber[sNum] ??
      (studentNameCounts.get(sName) === 1 ? paidByUniqueStudentName[sName] : 0) ??
      0;
    const remaining = Math.max(0, roundMoney(termPkg.total - roundMoney(remitted)));

    if (remaining > 0) {
      unpaidOrPartialPackageCount++;
      totalPackageReceivable = roundMoney(totalPackageReceivable + remaining);
    }
  });

  if (unpaidOrPartialPackageCount > 0) {
    collectiblesMap[`Unsettled Departmental Fees (${term})`] = {
      category: `Unsettled Departmental Fees (${term})`,
      headcount: unpaidOrPartialPackageCount,
      total: roundMoney(totalPackageReceivable),
    };
  }

  const explicitCollectibleItemKeys = new Set(
    explicitCollectibles.map((ec: any) =>
      normalizeItemKey(
        (String(ec.category || '').startsWith('Arrears: ')
          ? String(ec.category).substring(9).split(' - ')[0]
          : ec.category) || 'Unassigned'
      )
    )
  );

  obligationGroups.forEach((group) => {
    const remaining = Math.max(0, roundMoney(group.assessedAmount - group.paidAmount));
    if (
      (remaining > 0 || group.hasOutstandingMarker) &&
      !explicitCollectibleItemKeys.has(normalizeItemKey(group.itemName))
    ) {
      if (!collectiblesMap[group.itemName]) {
        collectiblesMap[group.itemName] = { category: group.itemName, headcount: 0, total: 0 };
      }
      collectiblesMap[group.itemName].headcount++;
      collectiblesMap[group.itemName].total = roundMoney(
        collectiblesMap[group.itemName].total + (remaining > 0 ? remaining : group.assessedAmount)
      );
    }
  });

  explicitCollectibles.forEach((ec: any) => {
    const rawCat = String(ec.category || 'Unassigned').trim();
    const itemName = rawCat.startsWith('Arrears: ')
      ? rawCat.substring(9).split(' - ')[0] || rawCat
      : rawCat;
    if (!collectiblesMap[itemName]) {
      collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
    }
    collectiblesMap[itemName].headcount += Number(ec.headcount) || 1;
    collectiblesMap[itemName].total = roundMoney(
      collectiblesMap[itemName].total + (Number(ec.balanceDue) || 0)
    );
  });

  const collectiblesList = Object.values(collectiblesMap);
  const totalCollectiblesSum = roundMoney(
    collectiblesList.reduce((sum, c) => sum + c.total, 0)
  );

  // 7. FUNDS, TRANSFERS & BALANCES (🚀 Fixed F43: Include initialAllocation and netTransfers)
  const initialAllocMap = initialFunds.reduce((acc: Record<string, number>, f: any) => {
    const n = String(f.fundName || '').trim();
    if (n) acc[n] = roundMoney((acc[n] || 0) + (Number(f.initialAllocation) || 0));
    return acc;
  }, {});

  const totalInitialAlloc = roundMoney(
    (Object.values(initialAllocMap) as number[]).reduce((s, a) => s + a, 0)
  );

  let carryOverInboundTotal = 0;
  const transferEffects = fundTransfers.reduce((acc: Record<string, number>, t: any) => {
    const amt = roundMoney(t.amount);
    if (amt > 0) {
      const src = String(t.sourceFund || '').trim();
      const dst = String(t.destinationFund || '').trim();
      if (src.toLowerCase().includes('rollover')) {
        if (dst) acc[dst] = roundMoney((acc[dst] || 0) + amt);
        carryOverInboundTotal = roundMoney(carryOverInboundTotal + amt);
      } else {
        if (src) acc[src] = roundMoney((acc[src] || 0) - amt);
        if (dst) acc[dst] = roundMoney((acc[dst] || 0) + amt);
      }
    }
    return acc;
  }, {});

  const fundsList = Array.from(
    new Set([
      ...Object.keys(collectionsByFund),
      ...Object.keys(expensesByFund),
      ...Object.keys(initialAllocMap),
      ...Object.keys(unliquidatedByFund),
      ...Object.keys(transferEffects),
    ])
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const initialAllocation = roundMoney(initialAllocMap[name] || 0);
      const netTransfers = roundMoney(transferEffects[name] || 0);
      const collected = roundMoney(collectionsByFund[name] || 0);
      const spent = roundMoney(expensesByFund[name] || 0);
      const unliquidated = roundMoney(unliquidatedByFund[name] || 0);
      const balance = roundMoney(
        initialAllocation + collected - spent - unliquidated + netTransfers
      );
      return {
        name,
        initialAllocation,
        netTransfers,
        collected,
        spent,
        unliquidated,
        balance,
      };
    });

  const remainingBalance = roundMoney(
    totalInitialAlloc +
      grandCollectionTotal -
      grandExpenseTotal -
      totalUnliquidated +
      carryOverInboundTotal
  );

  // 8. FINAL RETURN
  return {
    grandCollectionTotal,
    grandExpenseTotal,
    totalUnliquidated,
    totalCollectibles: totalCollectiblesSum,
    remainingBalance,
    unliquidatedAdvances,
    collectionHierarchy,
    expensesByFund,
    collectiblesList,
    fundsList,
    termPkg,
    cashierBalance,
    totalDeposited,
    totalWithdrawn,
  };
}

// =========================================================================
// COLLECTION SETUP
// =========================================================================

export async function saveCollectionSetupItem(
  department: string,
  p: {
    category: string;
    name: string;
    amount: number;
    targetFund: string;
    isPackage: boolean;
    ay: string;
    term: string;
  }
) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-setup', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);

  const name = String(p.name || '').trim();
  const category = String(p.category || '').trim();
  const targetFund = String(p.targetFund || '').trim();
  const amount = money(p.amount, 'Collection setup amount');

  if (!name || !targetFund) {
    throw new Error('Collection setup name and target fund are required.');
  }

  const updateData = { category, amount, targetFund, isPackage: Boolean(p.isPackage) };
  const existing = await prisma.collectionSetup.findFirst({
    where: { organizationId: orgId, academicYear: p.ay, term: p.term, name },
  });

  if (existing) {
    await prisma.collectionSetup.update({ where: { id: existing.id }, data: updateData });
  } else {
    await prisma.collectionSetup.create({
      data: { organizationId: orgId, academicYear: p.ay, term: p.term, name, ...updateData },
    });
  }

  await logSystemAction(
    orgId,
    officerName,
    existing ? 'UPDATE_COLLECTION_SETUP' : 'CREATE_COLLECTION_SETUP',
    `${existing ? 'Updated' : 'Created'} collection setup item '${name}' (₱${amount.toFixed(2)} -> ${targetFund}).`
  );

  revalidatePath(`/department/${cleanDept}/setup/collections`);
  revalidatePath(`/department/${cleanDept}/collections`);
  revalidatePath(`/department/${cleanDept}/reports`);
  revalidatePath(`/department/${cleanDept}/clearance`);
  revalidatePath(`/department/${cleanDept}`);

  return { success: true, message: `Configured '${name}' successfully.` };
}

export async function deleteCollectionSetupItem(department: string, setupId: string) {
  const cleanDept = normalizeDepartment(department);
  await requireTabAccess('tab-setup', cleanDept);
  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);

  const existing = await prisma.collectionSetup.findFirst({
    where: { id: setupId, organizationId: orgId },
  });

  const result = await prisma.collectionSetup.deleteMany({
    where: { id: setupId, organizationId: orgId },
  });
  if (result.count === 0) {
    throw new Error('Collection setup item not found or already removed.');
  }

  await logSystemAction(
    orgId,
    officerName,
    'DELETE_COLLECTION_SETUP',
    `Removed collection setup item '${existing?.name || setupId}'.`
  );

  revalidatePath(`/department/${cleanDept}/setup/collections`);
  revalidatePath(`/department/${cleanDept}/collections`);
  revalidatePath(`/department/${cleanDept}/reports`);
  revalidatePath(`/department/${cleanDept}/clearance`);
  revalidatePath(`/department/${cleanDept}`);

  return { success: true, message: 'Configuration item removed successfully.' };
}