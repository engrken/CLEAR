// /app/department/[department]/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';
import { requireTabAccess, isSuperAdminEmail } from '@/lib/permissions';
import { money as roundMoney } from '@/lib/utils';
import { computeDepartmentFinancials, isVoidedRecord } from '@/lib/financials';

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
  return computeDepartmentFinancials(organizationId, ay, term);
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