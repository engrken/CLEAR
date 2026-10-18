// /app/department/[department]/actions.ts

'use server';
import { manilaDateInput } from '@/lib/clear-timezone';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';
import { requireTabAccess, isSuperAdminEmail } from '@/lib/permissions';
import { money as roundMoney } from '@/lib/utils';
import { getPeriodLedger } from './(protected)/realign/ledger';

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

  // Allow configured Super Admin global inspection access.
  const role = String(sessionUser?.role || '').trim().toLowerCase();

  if (isSuperAdminEmail(email) || role === 'superadmin' || role === 'master') {
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

// Read NextAuth's name property first so audit logs display the officer's name.
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

export async function saveSignatories(
  _clientOrgId: string,
  department: string,
  signatories: any[]
) {
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
    await tx.signatory.deleteMany({
      where: { organizationId: orgId },
    });

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
        : {
            studentId: null,
            studentName: String(studentName || '').trim(),
          }),
    },
    select: {
      amountPaid: true,
      paymentType: true,
      status: true,
    },
  });

  return roundMoney(
    rows
      .filter((r) => !isVoidedRecord(r))
      .reduce((s, r) => s + (Number(r.amountPaid) || 0), 0)
  );
}

/** Legacy entry point intentionally disabled: it accepted arbitrary fund allocations
 * and did not link debt settlements. Use the verified Collections server action. */
export async function recordCollection(department: string, _data: any) {
  await requireTabAccess('tab-payment', normalizeDepartment(department));
  throw new Error('Legacy payment posting is disabled. Use Collections to issue a current-period OR or Collections → Previous-Term Arrears for older debts.');
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

  if (!sId || !name) {
    throw new Error('Student ID and name are required.');
  }

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
      // Preserve historical collections before deleting the student.
      await tx.collection.updateMany({
        where: {
          organizationId: orgId,
          studentId: existing.id,
        },
        data: { studentId: null },
      });

      await tx.enrollment.deleteMany({
        where: {
          organizationId: orgId,
          studentId: existing.id,
        },
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

// Central action retained for older callers. All realignments use the audited,
// balance-checked server implementation; do not bypass it here.
export async function transferFunds(
  department: string,
  data: { fromFund: string; toFund: string; amount: number; reason: string; ay: string; term: string }
) {
  const { transferFunds: verifiedTransfer } = await import('./(protected)/realign/actions');
  return verifiedTransfer(department, data);
}

export async function updateMyEmail(department: string, newEmail: string) {
  const cleanDept = normalizeDepartment(department);

  const sessionUser = (await auth())?.user as {
    email?: string;
  } | undefined;

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

  if (!user) {
    throw new Error('User record not found in this department.');
  }

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
    cashierRecords,
  ] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId, academicYear: ay, term },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
          },
        },
      },
    }),

    prisma.audit.findMany({
      where: { organizationId, academicYear: ay, term },
    }),

    prisma.cashAdvance.findMany({
      where: { organizationId, academicYear: ay, term },
      orderBy: { dateIssued: 'desc' },
    }),

    prisma.collectible.findMany({
      where: { organizationId, academicYear: ay, term },
    }),

    prisma.fund.findMany({
      where: { organizationId, academicYear: ay, term },
    }),

    prisma.student.findMany({
      where: { organizationId },
    }),

    prisma.enrollment.findMany({
      where: { organizationId, academicYear: ay, term },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
          },
        },
      },
    }),

    prisma.collectionSetup.findMany({
      where: { organizationId, academicYear: ay, term },
    }),

    prisma.cashierRemittance.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
        status: 'Remitted',
      },
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

  const validCollections = collections.filter(
    (c: any) => !isVoidedRecord(c)
  );

  const validAudits = audits.filter(
    (a: any) => !String(a.status || '').toUpperCase().match(/VOID|CANCEL/)
  );

  const getFundName = (row: any) =>
    [
      row.fundAllocation,
      row.fundSource,
      row.fundName,
      row.fund,
    ].find(
      (f) =>
        f &&
        String(f).trim() !== 'undefined' &&
        String(f).trim() !== 'null'
    ) || 'General Fund (Carried Over)';

  // 3. PACKAGE CONFIGURATION
  //
  // CollectionSetup is the ONLY source of package configuration.
  // These records have already been scoped by organizationId, AY and term
  // in the database query above.
  //
  // Do not add an FCU or other institution-specific fallback here.

  const pkgItems = collectionSetups.filter(
    (item: any) =>
      item.isPackage === true &&
      String(item.name || '').trim() !== ''
  );

  const termPkg = {
    total: roundMoney(
      pkgItems.reduce(
        (sum: number, item: any) =>
          sum + (Number(item.amount) || 0),
        0
      )
    ),

    items: pkgItems.map((item: any) => ({
      name: String(item.name || '').trim(),
      rate: roundMoney(Number(item.amount) || 0),
      fund: String(
        item.targetFund || item.name || ''
      ).trim(),
    })),
  };

  // 4. COLLECTIONS & MATCHING

  let grandCollectionTotal = 0;

  const collectionHierarchy: Record<
    string,
    { count: number; total: number }
  > = {};

  const distinctStudents: Record<string, Set<string>> = {};
  const collectionsByFund: Record<string, number> = {};

  const paidByDbStudentId: Record<string, number> = {};
  const paidByStudentNumber: Record<string, number> = {};
  const paidByUniqueStudentName: Record<string, number> = {};

  const studentsByDbId = new Map(
    students.map((s: any) => [String(s.id).toLowerCase(), s])
  );

  const studentsByStudentNumber = new Map(
    students
      .filter((s: any) => s.studentId)
      .map((s: any) => [String(s.studentId).toLowerCase(), s])
  );

  const studentNameCounts = new Map<string, number>();

  students.forEach((s: any) => {
    const name = String(s.fullName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    if (name) {
      studentNameCounts.set(
        name,
        (studentNameCounts.get(name) || 0) + 1
      );
    }
  });

  const addCollectionItem = (
    name: string,
    amt: number,
    key: string,
    fund: string
  ) => {
    grandCollectionTotal = roundMoney(grandCollectionTotal + amt);

    collectionsByFund[fund] = roundMoney(
      (collectionsByFund[fund] || 0) + amt
    );

    if (!collectionHierarchy[name]) {
      collectionHierarchy[name] = { count: 0, total: 0 };
      distinctStudents[name] = new Set();
    }

    collectionHierarchy[name].total = roundMoney(
      collectionHierarchy[name].total + amt
    );

    if (amt > 0 && key) {
      distinctStudents[name].add(key);
    }
  };

  const obligationGroups = new Map<string, any>();

  validCollections.forEach((c: any) => {
    const desc = String(
      c.itemDescription || c.category || 'General'
    ).trim();

    const descLower = desc.toLowerCase();
    const amt = roundMoney(c.amountPaid);
    const fund = getFundName(c);

    const studentKey = getStudentKey(
      c.studentId || c.student?.id,
      c.student?.fullName || c.studentName,
      String(c.orNumber || '').trim().toLowerCase()
    );

    const matchedPkgItem = termPkg.items.find(
      (pi: any) =>
        String(pi.name).trim().toLowerCase() === descLower
    );

    const isDepPkg = [
      'departmental fee package',
      'departmental fee',
      'departmental fee package (all items)',
    ].includes(descLower);

    if (matchedPkgItem) {
      addCollectionItem(
        matchedPkgItem.name,
        amt,
        studentKey,
        matchedPkgItem.fund
      );
    } else if (isDepPkg) {
      const pkgTotalRate = Number(termPkg.total) || 0;

      if (pkgTotalRate > 0) {
        termPkg.items.forEach((pi: any) => {
          addCollectionItem(
            pi.name,
            (Number(pi.rate) / pkgTotalRate) * amt,
            studentKey,
            pi.fund
          );
        });
      } else {
        addCollectionItem(desc, amt, studentKey, fund);
      }
    } else {
      addCollectionItem(desc, amt, studentKey, fund);
    }

    if ((matchedPkgItem || isDepPkg) && amt > 0) {
      const relId = String(c.student?.id || '').toLowerCase();
      const rawRef = String(c.studentId || '').toLowerCase();

      const uniqueName = String(
        c.student?.fullName || c.studentName || ''
      )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      if (relId && studentsByDbId.has(relId)) {
        paidByDbStudentId[relId] = roundMoney(
          (paidByDbStudentId[relId] || 0) + amt
        );
      } else if (rawRef && studentsByDbId.has(rawRef)) {
        paidByDbStudentId[rawRef] = roundMoney(
          (paidByDbStudentId[rawRef] || 0) + amt
        );
      } else if (rawRef && studentsByStudentNumber.has(rawRef)) {
        paidByStudentNumber[rawRef] = roundMoney(
          (paidByStudentNumber[rawRef] || 0) + amt
        );
      } else if (
        uniqueName &&
        studentNameCounts.get(uniqueName) === 1
      ) {
        paidByUniqueStudentName[uniqueName] = roundMoney(
          (paidByUniqueStudentName[uniqueName] || 0) + amt
        );
      }
    }

    if (!matchedPkgItem && !isDepPkg) {
      const itemName =
        desc || String(c.category || '').trim() || 'Other Due';

      const groupKey = `${studentKey}|${itemName.trim().toLowerCase()}`;

      const existing = obligationGroups.get(groupKey) || {
        studentKey,
        itemName,
        assessedAmount: 0,
        paidAmount: 0,
        hasOutstandingMarker: false,
      };

      existing.assessedAmount = Math.max(
        existing.assessedAmount,
        roundMoney(c.standardRate)
      );

      existing.paidAmount = roundMoney(
        existing.paidAmount + amt
      );

      existing.hasOutstandingMarker =
        existing.hasOutstandingMarker ||
        Number(c.balanceDue) > 0 ||
        String(c.paymentType).toLowerCase().includes('unpaid') ||
        String(c.orNumber).toUpperCase().startsWith('DUE-');

      obligationGroups.set(groupKey, existing);
    }
  });

  Object.keys(collectionHierarchy).forEach(
    (key) =>
      (collectionHierarchy[key].count =
        distinctStudents[key]?.size || 0)
  );

  // 5. EXPENSES & ADVANCES

  const expensesByFund: Record<string, number> = {};

  const grandExpenseTotal = roundMoney(
    validAudits.reduce((sum, a: any) => {
      const amt = roundMoney(a.totalExpense);
      const fund = getFundName(a);

      expensesByFund[fund] = roundMoney(
        (expensesByFund[fund] || 0) + amt
      );

      return sum + amt;
    }, 0)
  );

  let totalUnliquidated = 0;

  const unliquidatedByFund: Record<string, number> = {};

  const unliquidatedAdvances = cashAdvances
    .filter((ca: any) => {
      const status = String(ca.status || '').toUpperCase();

      return (
        (
          status.includes('PENDING') ||
          status.includes('UNLIQUIDATED') ||
          status === 'ACTIVE'
        ) &&
        !status.includes('CANCEL') &&
        !status.includes('VOID') &&
        (status.includes('UNLIQUIDATED') || !status.includes('LIQUIDATED'))
      );
    })
    .map((ca: any) => {
      const amt = roundMoney(ca.amountApproved);
      const fund = getFundName(ca);

      totalUnliquidated = roundMoney(
        totalUnliquidated + amt
      );

      unliquidatedByFund[fund] = roundMoney(
        (unliquidatedByFund[fund] || 0) + amt
      );

      return {
        id: ca.advanceId,
        advanceId: ca.advanceId,
        date: ca.dateIssued
          ? manilaDateInput(ca.dateIssued)
          : '',
        requestor: ca.requestor,
        fund,
        amount: amt,
        amountApproved: amt,
        due: ca.expectedReturnDate
          ? manilaDateInput(ca.expectedReturnDate)
          : '',
        status: ca.status,
      };
    });

  // 6. COLLECTIBLES

  const collectiblesMap: Record<
    string,
    { category: string; headcount: number; total: number }
  > = {};

  let totalPackageReceivable = 0;
  let unpaidOrPartialPackageCount = 0;

  const packageStudentMap = new Map(
    students.map((s: any) => [String(s.id), s])
  );

  enrollments
    .filter(
      (e: any) =>
        !['DROPPED', 'CANCELLED', 'INACTIVE'].includes(
          String(e.enrollmentStatus || '').toUpperCase()
        )
    )
    .forEach(
      (e: any) =>
        e.student?.id &&
        packageStudentMap.set(String(e.student.id), e.student)
    );

  Array.from(packageStudentMap.values()).forEach((s: any) => {
    if (!s?.id) return;

    const dbId = String(s.id).toLowerCase();
    const sNum = String(s.studentId || '').toLowerCase();

    const sName = String(s.fullName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    const remitted =
      paidByDbStudentId[dbId] ??
      paidByStudentNumber[sNum] ??
      (
        studentNameCounts.get(sName) === 1
          ? paidByUniqueStudentName[sName]
          : 0
      ) ??
      0;

    const remaining = Math.max(
      0,
      roundMoney(termPkg.total - roundMoney(remitted))
    );

    if (remaining > 0) {
      unpaidOrPartialPackageCount++;

      totalPackageReceivable = roundMoney(
        totalPackageReceivable + remaining
      );
    }
  });

  if (unpaidOrPartialPackageCount > 0) {
    collectiblesMap[`Unsettled Departmental Fees (${term})`] = {
      category: `Unsettled Departmental Fees (${term})`,
      headcount: unpaidOrPartialPackageCount,
      total: roundMoney(totalPackageReceivable),
    };
  }

  // Voided dues remain in the audit database, but do not create receivables.
  const validExplicitCollectibles = explicitCollectibles.filter((ec: any) =>
    !/VOID|CANCEL/i.test(String(ec.status || ''))
  );

  const explicitCollectibleItemKeys = new Set(
    validExplicitCollectibles.map((ec: any) =>
      normalizeItemKey(
        (
          String(ec.category || '').startsWith('Arrears: ')
            ? String(ec.category).substring(9).split(' - ')[0]
            : ec.category
        ) || 'Unassigned'
      )
    )
  );

  obligationGroups.forEach((group) => {
    const remaining = Math.max(
      0,
      roundMoney(group.assessedAmount - group.paidAmount)
    );

    if (
      (remaining > 0 || group.hasOutstandingMarker) &&
      !explicitCollectibleItemKeys.has(
        normalizeItemKey(group.itemName)
      )
    ) {
      if (!collectiblesMap[group.itemName]) {
        collectiblesMap[group.itemName] = {
          category: group.itemName,
          headcount: 0,
          total: 0,
        };
      }

      collectiblesMap[group.itemName].headcount++;

      collectiblesMap[group.itemName].total = roundMoney(
        collectiblesMap[group.itemName].total +
          (
            remaining > 0
              ? remaining
              : group.assessedAmount
          )
      );
    }
  });

  validExplicitCollectibles.forEach((ec: any) => {
    const rawCat = String(ec.category || 'Unassigned').trim();

    const itemName = rawCat.startsWith('Arrears: ')
      ? rawCat.substring(9).split(' - ')[0] || rawCat
      : rawCat;

    if (!collectiblesMap[itemName]) {
      collectiblesMap[itemName] = {
        category: itemName,
        headcount: 0,
        total: 0,
      };
    }

    collectiblesMap[itemName].headcount +=
      Number(ec.headcount) || 1;

    collectiblesMap[itemName].total = roundMoney(
      collectiblesMap[itemName].total +
        (Number(ec.balanceDue) || 0)
    );
  });

  const collectiblesList = Object.values(collectiblesMap);

  const totalCollectiblesSum = roundMoney(
    collectiblesList.reduce((sum, c) => sum + c.total, 0)
  );

  // 7. FUNDS, TRANSFERS & BALANCES
  // Use the exact same server-side ledger as Realign, including reversible
  // source-period debits and destination-period credits. Cashier deposits
  // only move custody and do NOT alter available fund assets.
  const periodLedger = await getPeriodLedger(prisma, organizationId, ay, term);
  const ledgerBalanceByName = new Map(periodLedger.funds.map(f => [f.name, f.balance]));
  const initialAllocMap = initialFunds.reduce((acc: Record<string, number>, f: any) => {
    const name = String(f.fundName || '').trim();
    if (name) acc[name] = roundMoney((acc[name] || 0) + (Number(f.initialAllocation) || 0));
    return acc;
  }, {});
  const fundsList = Array.from(new Set([
    ...periodLedger.funds.map(f => f.name),
    ...Object.keys(collectionsByFund),
    ...Object.keys(expensesByFund),
    ...Object.keys(unliquidatedByFund),
    ...Object.keys(initialAllocMap),
  ])).sort((a,b)=>a.localeCompare(b)).map(name => {
    const initialAllocation = roundMoney(initialAllocMap[name] || 0);
    const collected = roundMoney(collectionsByFund[name] || 0);
    const spent = roundMoney(expensesByFund[name] || 0);
    const unliquidated = roundMoney(unliquidatedByFund[name] || 0);
    const balance = roundMoney(ledgerBalanceByName.get(name) ?? 0);
    const netTransfers = roundMoney(balance - initialAllocation - collected + spent + unliquidated);
    return { name, initialAllocation, netTransfers, collected, spent, unliquidated, balance };
  });
  const remainingBalance = roundMoney(periodLedger.totalRemaining);
  const carryOverInboundTotal = roundMoney(periodLedger.carriedIn);
  const carryOverOutboundTotal = roundMoney(periodLedger.carriedOut);
  const hasActiveCarryOver = Boolean(periodLedger.activeRollover);

  // 8. FINAL RETURN

  return {
    grandCollectionTotal,
    grandExpenseTotal,
    totalUnliquidated,
    totalCollectibles: totalCollectiblesSum,
    remainingBalance,
    carryOverInboundTotal,
    carryOverOutboundTotal,
    hasActiveCarryOver,
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
// REPORT HEADER SETTINGS
// =========================================================================

export async function saveReportSettings(
  department: string,
  formData: FormData
) {
  const cleanDept = normalizeDepartment(department);

  // The current user must have report-tab access in this organization.
  await requireTabAccess('tab-report', cleanDept);

  const [officerName, orgId] = await Promise.all([
    getActionUser(),
    getOrgId(cleanDept),
  ]);

  const schoolName = String(
    formData.get('schoolName') || ''
  ).trim();

  const schoolAddress = String(
    formData.get('schoolAddress') || ''
  ).trim();

  if (!schoolName) {
    throw new Error('School or institution name is required.');
  }

  if (schoolName.length > 200) {
    throw new Error('School name must not exceed 200 characters.');
  }

  if (schoolAddress.length > 300) {
    throw new Error('School address must not exceed 300 characters.');
  }

  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      reportHeaderLeftLogo: true,
      reportHeaderRightLogo: true,
    },
  });

  if (!existing) {
    throw new Error('Organization not found.');
  }

  const allowedTypes: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  };

  const leftEntry = formData.get('leftLogo');
  const rightEntry = formData.get('rightLogo');

  const leftFile =
    leftEntry instanceof File && leftEntry.size > 0
      ? leftEntry
      : null;

  const rightFile =
    rightEntry instanceof File && rightEntry.size > 0
      ? rightEntry
      : null;

  for (const file of [leftFile, rightFile]) {
    if (!file) continue;

    if (!allowedTypes[file.type]) {
      throw new Error('Header images must be PNG, JPEG, or WebP files.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Each header image must be 5 MB or smaller.');
    }
  }

  const uploadedUrls: string[] = [];
  let databaseUpdated = false;
  let newLeftUrl: string | null = null;
  let newRightUrl: string | null = null;

  const uploadHeaderImage = async (
    file: File | null,
    side: 'left' | 'right'
  ): Promise<string | null> => {
    if (!file) return null;

    const extension = allowedTypes[file.type];

    const blob = await put(
      `report-headers/${orgId}/${side}-${Date.now()}.${extension}`,
      file,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.type,
      }
    );

    uploadedUrls.push(blob.url);

    return blob.url;
  };

  try {
    newLeftUrl = await uploadHeaderImage(leftFile, 'left');
    newRightUrl = await uploadHeaderImage(rightFile, 'right');

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        reportSchoolName: schoolName,
        reportSchoolAddress: schoolAddress || null,

        // If no replacement file was selected, keep the saved image.
        reportHeaderLeftLogo:
          newLeftUrl ?? existing.reportHeaderLeftLogo,

        reportHeaderRightLogo:
          newRightUrl ?? existing.reportHeaderRightLogo,
      },
    });

    databaseUpdated = true;
  } catch (error) {
    // Remove newly uploaded images if the database update failed.
    if (!databaseUpdated) {
      await Promise.all(
        uploadedUrls.map(async (url) => {
          try {
            await del(url);
          } catch (cleanupError) {
            console.warn(
              'Could not clean up an unused report image:',
              cleanupError
            );
          }
        })
      );
    }

    throw error;
  }

  // Delete replaced report-specific images only after saving their replacements.
  const obsoleteUrls = [
    newLeftUrl && existing.reportHeaderLeftLogo !== newLeftUrl
      ? existing.reportHeaderLeftLogo
      : null,
    newRightUrl && existing.reportHeaderRightLogo !== newRightUrl
      ? existing.reportHeaderRightLogo
      : null,
  ].filter((url): url is string => Boolean(url));

  for (const url of new Set(obsoleteUrls)) {
    if (!url.includes('vercel-storage.com')) continue;

    try {
      await del(url);
    } catch (error) {
      console.warn('Could not delete a replaced report image:', error);
    }
  }

  try {
    await logSystemAction(
      orgId,
      officerName,
      'UPDATE_REPORT_SETTINGS',
      `Updated report header settings for ${schoolName}.`
    );
  } catch (error) {
    console.warn('Report settings audit logging failed:', error);
  }

  revalidatePath(`/department/${cleanDept}/summary`);
  revalidatePath(`/department/${cleanDept}/liquidations`);
  revalidatePath(`/department/${cleanDept}`);

  return {
    success: true,
    message: 'Report header settings saved successfully.',
  };
}

// =========================================================================
// COLLECTION SETUP
// =========================================================================

/** Legacy fee-setup entry points are intentionally disabled; they previously allowed
 * editing/removing a used fee or changing a closed accounting period. */
export async function saveCollectionSetupItem(department: string, _data: {
  category: string; name: string; amount: number; targetFund: string;
  isPackage: boolean; ay: string; term: string;
}) {
  await requireTabAccess('tab-setup', normalizeDepartment(department));
  throw new Error('Use System Setup → Setup Collection Fees. This legacy action is disabled to protect historical fee and fund records.');
}

export async function deleteCollectionSetupItem(department: string, _setupId: string) {
  await requireTabAccess('tab-setup', normalizeDepartment(department));
  throw new Error('Use System Setup → Setup Collection Fees. This legacy action is disabled to protect historical fee and fund records.');
}
