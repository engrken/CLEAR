'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';
import { requireTabAccess, requireSuperAdmin } from '@/lib/permissions';

// =========================================================================
// GENERAL HELPERS
// =========================================================================

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}${pad(date.getSeconds())}`;
}

function normalizeDepartment(department: string) {
  const clean = String(department || '')
    .trim()
    .toLowerCase();

  if (!clean) {
    throw new Error('Department is required.');
  }

  return clean;
}

function parseAllowedTabs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch {
      return [];
    }
  }

  return [];
}

function parseDate(value: string, fieldName: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return date;
}

function money(value: unknown, fieldName = 'Amount') {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return Math.round(amount * 100) / 100;
}

function generateReference(prefix: string) {
  return `${prefix}-${formatDate(new Date())}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function isVoidedRecord(row: { paymentType?: unknown; status?: unknown }) {
  const paymentType = String(row.paymentType || '').toUpperCase();
  const status = String(row.status || '').toUpperCase();

  return paymentType.includes('VOID') || status.includes('VOID') || status.includes('CANCEL');
}

/**
 * IMPORTANT:
 * Collection.studentId references Student.id (UUID),
 * NOT Student.studentId.
 *
 * Therefore the financial engine should primarily use
 * the database student ID.
 */
function getStudentKey(studentDbId?: unknown, studentName?: unknown, fallback = '') {
  const id = String(studentDbId || '')
    .trim()
    .toLowerCase();

  const name = String(studentName || '')
    .trim()
    .toLowerCase();

  if (id) {
    return `ID:${id}`;
  }

  if (name) {
    return `NAME:${name}`;
  }

  return fallback;
}
function normalizeItemKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// =========================================================================
// ORGANIZATION / TENANT
// =========================================================================

/**
 * Public resolver.
 *
 * Do NOT require a session here.
 *
 * Used by:
 * - requestOtp()
 * - verifyOtp()
 * - submitOnlineRemittance()
 */
async function resolveOrganizationId(department: string) {
  const cleanDepartment = normalizeDepartment(department);

  const org = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
    select: {
      id: true,
    },
  });

  if (!org) {
    throw new Error('Department organization not found.');
  }

  return org.id;
}

/**
 * Verifies that the authenticated user belongs
 * to the requested organization.
 */
async function requireOrganizationAccess(organizationId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('401 Unauthorized: Session expired or invalid.');
  }

  const email = String(session.user.email || '')
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error('401 Unauthorized: Session has no email.');
  }

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId,
      email,
      status: 'Active',
    },
  });

  if (!user) {
    throw new Error('403 Forbidden: You do not have access to this department.');
  }

  return user;
}

/**
 * Authenticated organization resolver.
 *
 * Normal protected actions use this.
 */
async function getOrgId(department: string) {
  const organizationId = await resolveOrganizationId(department);

  await requireOrganizationAccess(organizationId);

  return organizationId;
}

async function getActionUser(): Promise<string> {
  const session = await auth();

  const user = session?.user as
    | {
        fullName?: string;
        email?: string;
      }
    | undefined;

  return user?.fullName || user?.email || 'System';
}

// =========================================================================
// DEPARTMENT PROVISIONING
// =========================================================================

  export async function saveSignatories(orgId: string, department: string, signatories: any[]) {
  // 1. We use a transaction to safely clear old signatories and insert the new ones
  await prisma.$transaction(async (tx) => {
    await tx.signatory.deleteMany({
      where: { organizationId: orgId }
    });

    if (signatories.length > 0) {
      await tx.signatory.createMany({
        data: signatories.map((sig, index) => ({
          organizationId: orgId,
          label: sig.label,
          name: sig.name,
          position: sig.position,
          order: index, // Automatically assigns the array order (0, 1, 2...)
        }))
      });
    }
  });

  // 2. Clear Next.js cache so the UI updates instantly
  revalidatePath(`/department/${department}/summary`);
  revalidatePath(`/department/${department}/liquidations`);
  
  return { success: true };
}

export async function createDepartment(formData: FormData) {
  await requireSuperAdmin();

  const name = String(formData.get('name') || '').trim();

  const subdomain = String(formData.get('subdomain') || '')
    .trim()
    .toLowerCase();

  if (!name || !subdomain) {
    throw new Error('Department name and subdomain are required.');
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error('Subdomain may contain only lowercase letters, numbers, and hyphens.');
  }

  try {
    await prisma.organization.create({
      data: {
        name,
        subdomain,
      },
    });

    revalidatePath('/');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `Department '${name}' successfully registered!`,
    };
  } catch (error) {
    console.error('createDepartment error:', error);

    return {
      success: false,
      message: 'Subdomain already exists or the department could not be created.',
    };
  }
}

// =========================================================================
// PAYMENT HELPER
// =========================================================================

async function validateStudentOwnership(organizationId: string, studentDbId?: string | null) {
  const cleanId = String(studentDbId || '').trim();

  if (!cleanId) {
    return null;
  }

  const student = await prisma.student.findFirst({
    where: {
      id: cleanId,
      organizationId,
    },
    select: {
      id: true,
      studentId: true,
      fullName: true,
      email: true,
    },
  });

  if (!student) {
    throw new Error('Selected student does not belong to this department.');
  }

  return student;
}

/**
 * Calculates historical valid payments for the same student + item.
 *
 * Collection.studentId is the Student.id foreign key.
 */
async function getPreviouslyPaid(
  organizationId: string,
  studentDbId: string | null | undefined,
  studentName: string,
  academicYear: string,
  term: string,
  itemDescription: string,
) {
  const cleanStudentId = String(studentDbId || '').trim();

  const cleanStudentName = String(studentName || '').trim();

  const cleanDescription = String(itemDescription || '').trim();

  if (!cleanDescription) {
    return 0;
  }

  const rows = await prisma.collection.findMany({
    where: {
      organizationId,
      academicYear,
      term,
      itemDescription: cleanDescription,
      ...(cleanStudentId
        ? {
            studentId: cleanStudentId,
          }
        : {
            studentId: null,
            studentName: cleanStudentName,
          }),
    },
    select: {
      amountPaid: true,
      paymentType: true,
      status: true,
    },
  });

  return rows.filter((row) => !isVoidedRecord(row)).reduce((sum, row) => sum + (Number(row.amountPaid) || 0), 0);
}

// =========================================================================
// COLLECTION
// =========================================================================

export async function recordCollection(
  department: string,
  data: {
    orNumber: string;
    studentId: string;
    studentName: string;
    category: string;
    itemDescription: string;
    paymentType: string;
    amountPaid: number;
    standardRate: number;
    fundAllocation: string;
    ay: string;
    term: string;
  },
) {
  await requireTabAccess('tab-payment');

  const officerName = await getActionUser();

  const orgId = await getOrgId(department);

  const studentDbId = String(data.studentId || '').trim() || null;

  await validateStudentOwnership(orgId, studentDbId);

  const paid = money(data.amountPaid, 'Payment amount');

  const rate = money(data.standardRate, 'Standard rate');

  if (paid <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (rate <= 0) {
    throw new Error('The payment has no valid standard rate.');
  }

  const itemDescription = String(data.itemDescription || '').trim();

  const category = String(data.category || '').trim();

  if (!itemDescription) {
    throw new Error('Item description is required.');
  }

  const alreadyPaid = await getPreviouslyPaid(
    orgId,
    studentDbId,
    data.studentName,
    data.ay,
    data.term,
    itemDescription,
  );

  const remainingBeforePayment = Math.max(0, Math.round((rate - alreadyPaid) * 100) / 100);

  if (remainingBeforePayment <= 0) {
    throw new Error(`This assessment has already been fully paid at ₱${rate.toFixed(2)}.`);
  }

  if (paid > remainingBeforePayment) {
    throw new Error(
      `Payment amount ₱${paid.toFixed(2)} exceeds the remaining balance of ₱${remainingBeforePayment.toFixed(2)}.`,
    );
  }

  const newTotalPaid = alreadyPaid + paid;

  const balanceDue = Math.max(0, Math.round((rate - newTotalPaid) * 100) / 100);

  const actualPaymentType =
    balanceDue === 0 ? 'Full Payment' : String(data.paymentType || '').trim() || 'Partial Payment';

  await prisma.collection.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      orNumber: String(data.orNumber || '').trim(),
      studentId: studentDbId,
      studentName: String(data.studentName || '').trim(),
      category,
      itemDescription,
      paymentType: actualPaymentType,
      standardRate: rate,
      amountPaid: paid,
      balanceDue,
      fundAllocation: String(data.fundAllocation || '').trim(),
      status: 'Valid',
      encodedBy: officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    'RECORD_COLLECTION',
    `Collected ₱${paid.toFixed(2)} from ${data.studentName} for ${itemDescription} [OR: ${data.orNumber}].`,
  );

  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);
}

// =========================================================================
// OTP LOGIN
// =========================================================================

export async function requestOtp(department: string, email: string) {
  const cleanDepartment = normalizeDepartment(department);
  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  // NEW: Fetch the full organization record, not just the ID
  const org = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!org) {
    throw new Error('Department or Organization not found.');
  }

  const orgId = org.id;

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: cleanEmail,
    },
  });

  if (!user) {
    throw new Error('This account is not registered or does not belong to this department.');
  }

  if (user.status !== 'Active') {
    throw new Error('This account is currently inactive.');
  }

  const cookieStore = await cookies();

  const lockoutCookie = cookieStore.get('fcu_lockout');

  if (lockoutCookie) {
    const lockoutTime = Number.parseInt(lockoutCookie.value, 10);

    if (Number.isFinite(lockoutTime) && Date.now() < lockoutTime) {
      const remainingMinutes = Math.ceil((lockoutTime - Date.now()) / 60000);

      throw new Error(
        `Too many failed attempts. Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
      );
    }
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();

  const hashedCode = crypto.createHash('sha256').update(otpCode).digest('hex');

  const expiresAt = Date.now() + 5 * 60 * 1000;

  const smtpUser = process.env.SMTP_USER;

  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('Email service is not configured.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  // Send first. Only store the OTP if sending succeeds.
  try {
    await transporter.sendMail({
      from: `"CLEAR System" <${smtpUser}>`,
      to: cleanEmail,
      // NEW: Dynamically use the true organization name from the database!
      subject: `[CLEAR System] OTP CODE FOR ${org.name.toUpperCase()}`,
      text: `Your 6-digit One-Time PIN is: ${otpCode}\n\nThis code will expire in 5 minutes.`,
    });
  } catch (error) {
    console.error('SMTP Error:', error);
    throw new Error('Failed to dispatch verification email.');
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 300,
  };

  cookieStore.set('fcu_otp_hash', `${hashedCode}:${expiresAt}`, cookieOptions);

  cookieStore.set('fcu_otp_email', cleanEmail, cookieOptions);

  cookieStore.set('fcu_otp_department', cleanDepartment, cookieOptions);

  cookieStore.set('fcu_otp_strikes', '0', cookieOptions);

  return {
    success: true,
    message: 'Verification code sent successfully.',
  };
}

export async function verifyOtp(department: string, email: string, submittedOtp: string) {
  const cleanDepartment = normalizeDepartment(department);

  const cleanEmail = String(email || '')
    .trim()
    .toLowerCase();

  const cleanOtp = String(submittedOtp || '').trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error('Verification code must be exactly 6 digits.');
  }

  const cookieStore = await cookies();

  const otpCookie = cookieStore.get('fcu_otp_hash');

  const emailCookie = cookieStore.get('fcu_otp_email');

  const departmentCookie = cookieStore.get('fcu_otp_department');

  const strikesCookie = cookieStore.get('fcu_otp_strikes');

  if (!otpCookie || !emailCookie || !departmentCookie) {
    throw new Error('Verification session expired. Please request a new code.');
  }

  if (emailCookie.value !== cleanEmail) {
    throw new Error('Email mismatch. Please request a new code.');
  }

  if (departmentCookie.value !== cleanDepartment) {
    throw new Error('Department mismatch. Please request a new verification code.');
  }

  let currentStrikes = strikesCookie ? Number.parseInt(strikesCookie.value, 10) : 0;

  if (!Number.isFinite(currentStrikes)) {
    currentStrikes = 0;
  }

  if (currentStrikes >= 5) {
    const lockoutUntil = Date.now() + 10 * 60 * 1000;

    cookieStore.set('fcu_lockout', lockoutUntil.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });

    throw new Error('Maximum verification attempts exceeded. Account locked for 10 minutes.');
  }

  const [storedHash, expiryStr] = otpCookie.value.split(':');

  const expiresAt = Number.parseInt(expiryStr, 10);

  if (!storedHash || !Number.isFinite(expiresAt)) {
    throw new Error('Invalid verification session. Please request a new code.');
  }

  if (Date.now() > expiresAt) {
    cookieStore.delete('fcu_otp_hash');
    cookieStore.delete('fcu_otp_email');
    cookieStore.delete('fcu_otp_department');
    cookieStore.delete('fcu_otp_strikes');

    throw new Error('Verification code has expired. Please request a new one.');
  }

  const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');

  const storedBuffer = Buffer.from(storedHash, 'utf8');

  const submittedBuffer = Buffer.from(submittedHash, 'utf8');

  let valid = false;

  if (storedBuffer.length === submittedBuffer.length) {
    valid = crypto.timingSafeEqual(storedBuffer, submittedBuffer);
  }

  if (!valid) {
    currentStrikes += 1;

    cookieStore.set('fcu_otp_strikes', currentStrikes.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    });

    if (currentStrikes >= 5) {
      const lockoutUntil = Date.now() + 10 * 60 * 1000;

      cookieStore.set('fcu_lockout', lockoutUntil.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      });

      throw new Error('Maximum verification attempts exceeded. Account locked for 10 minutes.');
    }

    throw new Error(`Invalid verification code. ${5 - currentStrikes} attempt(s) remaining.`);
  }

  // Still pre-authentication.
  const orgId = await resolveOrganizationId(cleanDepartment);

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: cleanEmail,
    },
  });

  if (!user) {
    throw new Error('User record not found.');
  }

  if (user.status !== 'Active') {
    throw new Error('This account is currently inactive.');
  }

  cookieStore.delete('fcu_otp_hash');
  cookieStore.delete('fcu_otp_email');
  cookieStore.delete('fcu_otp_department');
  cookieStore.delete('fcu_otp_strikes');
  cookieStore.delete('fcu_lockout');

  // Preserved because your existing application uses it.
  cookieStore.set('fcu_session', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  });

  return {
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      allowedTabs: parseAllowedTabs(user.allowedTabs),
    },
  };
}

// =========================================================================
// STUDENTS
// =========================================================================

export async function upsertStudent(
  department: string,
  data: {
    studentId: string;
    fullName: string;
    email: string;
  },
) {
  await requireTabAccess('tab-students');

  const officerName = await getActionUser();

  const orgId = await getOrgId(department);

  const cleanStudentId = String(data.studentId || '').trim();

  const cleanFullName = String(data.fullName || '').trim();

  const cleanEmail = String(data.email || '').trim();

  if (!cleanStudentId) {
    throw new Error('Student ID is required.');
  }

  if (!cleanFullName) {
    throw new Error('Student name is required.');
  }

  const existing = await prisma.student.findFirst({
    where: {
      organizationId: orgId,
      studentId: cleanStudentId,
    },
  });

  if (existing) {
    await prisma.student.update({
      where: {
        id: existing.id,
      },
      data: {
        fullName: cleanFullName,
        email: cleanEmail || null,
      },
    });
  } else {
    await prisma.student.create({
      data: {
        organizationId: orgId,
        studentId: cleanStudentId,
        fullName: cleanFullName,
        email: cleanEmail || null,
        yearLevel: 'N/A',
      },
    });
  }

  await logSystemAction(
    orgId,
    officerName,
    existing ? 'UPDATE_STUDENT' : 'ADD_STUDENT',
    `${existing ? 'Modified' : 'Registered'} profile for ${cleanFullName} (${cleanStudentId}).`,
  );

  revalidatePath(`/department/${department}/students`);
  revalidatePath(`/department/${department}/clearance`);
}

export async function deleteStudent(department: string, studentId: string) {
  await requireTabAccess('tab-students');

  const officerName = await getActionUser();

  const orgId = await getOrgId(department);

  const cleanStudentId = String(studentId || '').trim();

  if (!cleanStudentId) {
    throw new Error('Student ID is required.');
  }

  const existing = await prisma.student.findFirst({
    where: {
      organizationId: orgId,
      studentId: cleanStudentId,
    },
  });

  if (existing) {
    await prisma.student.delete({
      where: {
        id: existing.id,
      },
    });

    await logSystemAction(
      orgId,
      officerName,
      'DELETE_STUDENT',
      `Permanently removed student record for ${existing.fullName} (${existing.studentId}).`,
    );
  }

  revalidatePath(`/department/${department}/students`);
  revalidatePath(`/department/${department}/clearance`);
}

// =========================================================================
// FUND TRANSFERS
// =========================================================================

export async function transferFunds(
  department: string,
  data: {
    fromFund: string;
    toFund: string;
    amount: number;
    reason: string;
    ay: string;
    term: string;
  },
) {
  await requireTabAccess('tab-transfer');

  const officerName = await getActionUser();

  const orgId = await getOrgId(department);

  const fromFund = String(data.fromFund || '').trim();

  const toFund = String(data.toFund || '').trim();

  const amount = money(data.amount, 'Transfer amount');

  if (!fromFund || !toFund) {
    throw new Error('Both source and destination funds are required.');
  }

  if (fromFund.toLowerCase() === toFund.toLowerCase()) {
    throw new Error('Source and destination funds must be different.');
  }

  if (amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  await prisma.fundTransfer.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      sourceFund: fromFund,
      destinationFund: toFund,
      amount,
      reason: String(data.reason || '').trim(),
      encodedBy: officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    'TRANSFER_FUNDS',
    `Realigned ₱${amount.toFixed(2)} from ${fromFund} to ${toFund}.`,
  );

  revalidatePath(`/department/${department}/realign`);
  revalidatePath(`/department/${department}`);
}

// =========================================================================
// UPDATE MY EMAIL
// =========================================================================

export async function updateMyEmail(department: string, newEmail: string) {
  const session = await auth();

  const sessionUser = session?.user as
    | {
        email?: string;
      }
    | undefined;

  if (!sessionUser?.email) {
    throw new Error('Unauthorized: No active session found.');
  }

  const orgId = await getOrgId(department);

  const cleanCurrentEmail = sessionUser.email.trim().toLowerCase();

  const cleanNewEmail = String(newEmail || '')
    .trim()
    .toLowerCase();

  if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: cleanCurrentEmail,
    },
  });

  if (!user) {
    throw new Error('User record not found in this department.');
  }

  const existing = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: cleanNewEmail,
    },
  });

  if (existing && existing.id !== user.id) {
    throw new Error('This email is already registered by another account.');
  }

  await prisma.tenantUser.update({
    where: {
      id: user.id,
    },
    data: {
      email: cleanNewEmail,
    },
  });

  revalidatePath(`/department/${department}`);

  return {
    success: true,
    message: 'Email updated successfully! Please sign out and sign back in to apply changes fully.',
  };
}

// =========================================================================
// FINANCIAL ENGINE
// =========================================================================

export async function getDepartmentFinancials(
  organizationId: string,
  ay: string,
  term: string,
  isPublic: boolean = false,
) {
  if (!isPublic) {
    await requireOrganizationAccess(organizationId); // Or however it is formatted internally
  }

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
  ] = await Promise.all([
    prisma.collection.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
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
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.cashAdvance.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
      orderBy: {
        dateIssued: 'desc',
      },
    }),

    prisma.collectible.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.fund.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.student.findMany({
      where: {
        organizationId,
      },
    }),

    prisma.enrollment.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
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
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.fundTransfer.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),
  ]);

  // =========================================================================
  // VALID COLLECTIONS / AUDITS
  // =========================================================================

  const validCollections = collections.filter((c: any) => !isVoidedRecord(c));

  const validAudits = audits.filter((a: any) => {
    const status = String(a.status || '').toUpperCase();

    return !status.includes('VOID') && !status.includes('CANCEL');
  });

  // =========================================================================
  // LEGACY PACKAGE DEFINITIONS
  // =========================================================================

  const legacyTermPackages: Record<
    string,
    {
      total: number;
      items: {
        name: string;
        rate: number;
        fund: string;
      }[];
    }
  > = {
    '1st Sem': {
      total: 650,
      items: [
        {
          name: 'JIECEP FCUSC Membership Fee (Student & Institutional)',
          rate: 250,
          fund: 'JIECEP Membership Fund',
        },
        {
          name: 'General Orientation/Acquaintance Party',
          rate: 200,
          fund: 'General Orientation Fund',
        },
        {
          name: 'COE FCUSR Activities',
          rate: 100,
          fund: 'FCUSR Activities Fund',
        },
        {
          name: 'Sports and Cultural Fund',
          rate: 100,
          fund: 'Sports & Cultural Fund',
        },
      ],
    },

    '2nd Sem': {
      total: 900,
      items: [
        {
          name: 'JIECEP FCUSC Fund',
          rate: 50,
          fund: 'JIECEP FCUSC Fund',
        },
        {
          name: 'JIECEP Week Activities (Local & Regional)',
          rate: 150,
          fund: 'JIECEP Week Activities Fund',
        },
        {
          name: 'ECE Grand Ball',
          rate: 650,
          fund: 'ECE Grandball Fund',
        },
        {
          name: 'Emergency/Calamity Fund',
          rate: 30,
          fund: 'Emergency/Calamity Fund',
        },
        {
          name: 'FCUSR Activities & Projects',
          rate: 20,
          fund: 'FCUSR Activities Fund',
        },
      ],
    },

    Summer: {
      total: 200,
      items: [
        {
          name: 'Summer Departmental Operations',
          rate: 150,
          fund: 'New Accounts (Current Operations)',
        },
        {
          name: 'Special Activities Fund',
          rate: 50,
          fund: 'JIECEP Activities Fund',
        },
      ],
    },
  };

  // =========================================================================
  // PACKAGE SETUP
  // =========================================================================

  let pkgTotal = 0;

  const currentPkgItems: {
    name: string;
    rate: number;
    fund: string;
  }[] = [];

  const packageItems = collectionSetups.filter((c: any) => c.isPackage !== false);

  if (packageItems.length > 0) {
    packageItems.forEach((s: any) => {
      const amount = Number(s.amount) || 0;

      pkgTotal += amount;

      currentPkgItems.push({
        name: String(s.name || '').trim(),
        rate: amount,
        fund: String(s.targetFund || '').trim(),
      });
    });
  } else {
    const fallbackPkg = legacyTermPackages[term] || legacyTermPackages['1st Sem'];

    pkgTotal = fallbackPkg.total;

    currentPkgItems.push(...fallbackPkg.items);
  }

  const termPkg = {
    total: pkgTotal,
    items: currentPkgItems,
  };

  // =========================================================================
  // FUND NAME
  // =========================================================================

  const getFundName = (row: any) => {
    const raw = String(row.fundAllocation || row.fundSource || row.fundName || row.fund || '').trim();

    return raw === '' || raw === 'undefined' || raw === 'null' ? 'General Fund (Carried Over)' : raw;
  };

  // =========================================================================
  // COLLECTION TOTALS
  // =========================================================================

  let grandCollectionTotal = 0;

  const collectionHierarchy: Record<
    string,
    {
      count: number;
      total: number;
    }
  > = {};

  const distinctStudents: Record<string, Set<string>> = {};

  const collectionsByFund: Record<string, number> = {};

  const addCollectionItem = (itemName: string, amt: number, studentKey: string, fund: string) => {
    grandCollectionTotal += amt;

    collectionsByFund[fund] = (collectionsByFund[fund] || 0) + amt;

    if (!collectionHierarchy[itemName]) {
      collectionHierarchy[itemName] = {
        count: 0,
        total: 0,
      };

      distinctStudents[itemName] = new Set();
    }

    collectionHierarchy[itemName].total += amt;

    if (amt > 0 && studentKey) {
      distinctStudents[itemName].add(studentKey);
    }
  };

  validCollections.forEach((c: any) => {
    const itemDesc = String(c.itemDescription || c.category || 'General').trim();

    const amt = Number(c.amountPaid) || 0;

    /*
     * Because Collection.studentId is Student.id,
     * use c.studentId or the included student.id.
     */
    const studentKey = getStudentKey(
      c.studentId || c.student?.id,
      c.student?.fullName || c.studentName,
      String(c.orNumber || '')
        .trim()
        .toLowerCase(),
    );

    const fund = getFundName(c);

    const matchedPkgItem = termPkg.items.find(
      (pi: any) =>
        String(pi.name || '')
          .trim()
          .toLowerCase() === itemDesc.toLowerCase(),
    );

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey, matchedPkgItem.fund);
    } else if (
      itemDesc.toLowerCase() === 'departmental fee package' ||
      itemDesc.toLowerCase() === 'departmental fee' ||
      itemDesc.toLowerCase() === 'departmental fee package (all items)'
    ) {
      const pkgToUse = termPkg.items.length > 0 ? termPkg : legacyTermPackages[term] || legacyTermPackages['1st Sem'];

      const pkgTotalRate = Number(pkgToUse.total) || 0;

      if (pkgTotalRate > 0) {
        pkgToUse.items.forEach((pi: any) => {
          const share = (Number(pi.rate) / pkgTotalRate) * amt;

          addCollectionItem(pi.name, share, studentKey, pi.fund);
        });
      } else {
        addCollectionItem(itemDesc, amt, studentKey, fund);
      }
    } else {
      addCollectionItem(itemDesc, amt, studentKey, fund);
    }
  });

  Object.keys(collectionHierarchy).forEach((key) => {
    collectionHierarchy[key].count = distinctStudents[key]?.size || 0;
  });

  // =========================================================================
  // EXPENSES
  // =========================================================================

  let grandExpenseTotal = 0;

  const expensesByFund: Record<string, number> = {};

  validAudits.forEach((a: any) => {
    const amt = Number(a.totalExpense) || 0;

    grandExpenseTotal += amt;

    const fund = getFundName(a);

    expensesByFund[fund] = (expensesByFund[fund] || 0) + amt;
  });

  // =========================================================================
  // UNLIQUIDATED ADVANCES
  // =========================================================================

  let totalUnliquidated = 0;

  const unliquidatedAdvances: any[] = [];

  const unliquidatedByFund: Record<string, number> = {};

  cashAdvances.forEach((ca: any) => {
    const status = String(ca.status || '').toUpperCase();

    /*
     * Supports both:
     * - Active (Unliquidated)
     * - Pending Liquidation
     *
     * because your schema default and action-created
     * status values are different.
     */
    const isPending = status.includes('PENDING') || status.includes('UNLIQUIDATED') || status === 'ACTIVE';

    if (isPending && !status.includes('CANCEL') && !status.includes('LIQUIDATED')) {
      const amt = Number(ca.amountApproved) || 0;

      totalUnliquidated += amt;

      const fund = getFundName(ca);

      unliquidatedByFund[fund] = (unliquidatedByFund[fund] || 0) + amt;

      unliquidatedAdvances.push({
        id: ca.advanceId,
        date: ca.dateIssued ? new Date(ca.dateIssued).toISOString().split('T')[0] : '',
        requestor: ca.requestor,
        fund,
        amount: amt,
        due: ca.expectedReturnDate ? new Date(ca.expectedReturnDate).toISOString().split('T')[0] : '',
        status: ca.status,
      });
    }
  });
  


  // =========================================================================
  // PACKAGE PAYMENT MAP
  // =========================================================================
  // Collection.studentId SHOULD contain Student.id (UUID).
  //
  // However, older records may contain Student.studentId instead,
  // such as "20-C0524".
  //
  // This implementation supports BOTH:
  //
  // 1. Collection.studentId = Student.id
  // 2. Collection.studentId = Student.studentId
  // 3. Collection.studentName = unique Student.fullName
  //
  // Matching priority:
  //    Student.id
  //    -> Student.studentId
  //    -> unique Student.fullName
  //
  // Each collection record is counted only once.
  // =========================================================================

  const paidByDbStudentId: Record<string, number> = {};
  const paidByStudentNumber: Record<string, number> = {};
  const paidByUniqueStudentName: Record<string, number> = {};

  // =========================================================================
  // BUILD STUDENT LOOKUP MAPS
  // =========================================================================

  const studentsByDbId = new Map<string, any>();
  const studentsByStudentNumber = new Map<string, any>();
  const studentNameCounts = new Map<string, number>();

  students.forEach((student: any) => {
    if (!student?.id) {
      return;
    }

    const dbId = String(student.id).trim().toLowerCase();

    const studentNumber = String(student.studentId || '')
      .trim()
      .toLowerCase();

    const studentName = String(student.fullName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    studentsByDbId.set(dbId, student);

    if (studentNumber) {
      studentsByStudentNumber.set(studentNumber, student);
    }

    if (studentName) {
      studentNameCounts.set(studentName, (studentNameCounts.get(studentName) || 0) + 1);
    }
  });

  // =========================================================================
  // READ PACKAGE PAYMENTS
  // =========================================================================

  validCollections.forEach((c: any) => {
    const descLower = String(c.itemDescription || '')
      .trim()
      .toLowerCase();

    // -----------------------------------------------------------------------
    // Determine whether this collection belongs to the departmental package.
    // -----------------------------------------------------------------------

    const isPackageItem = termPkg.items.some(
      (pi: any) =>
        String(pi.name || '')
          .trim()
          .toLowerCase() === descLower,
    );

    const isDepartmentalPackage =
      descLower === 'departmental fee package' ||
      descLower === 'departmental fee' ||
      descLower === 'departmental fee package (all items)';

    // Ignore unrelated collections such as:
    // Laboratory Fee
    // Penalty Fee
    // Replacement Fee
    // etc.
    if (!isPackageItem && !isDepartmentalPackage) {
      return;
    }

    const paid = Number(c.amountPaid) || 0;

    if (paid <= 0) {
      return;
    }

    // =======================================================================
    // 1. BEST MATCH: Prisma Student relation
    //
    // If c.student exists, c.student.id is definitely Student.id.
    // =======================================================================

    const relationDbId = String(c.student?.id || '')
      .trim()
      .toLowerCase();

    if (relationDbId && studentsByDbId.has(relationDbId)) {
      paidByDbStudentId[relationDbId] = (paidByDbStudentId[relationDbId] || 0) + paid;

      return;
    }

    // =======================================================================
    // 2. CORRECT SCHEMA MATCH:
    // Collection.studentId = Student.id
    // =======================================================================

    const rawStudentReference = String(c.studentId || '')
      .trim()
      .toLowerCase();

    if (rawStudentReference && studentsByDbId.has(rawStudentReference)) {
      paidByDbStudentId[rawStudentReference] = (paidByDbStudentId[rawStudentReference] || 0) + paid;

      return;
    }

    // =======================================================================
    // 3. LEGACY MATCH:
    // Collection.studentId = Student.studentId
    //
    // Example:
    // Collection.studentId = "20-C0524"
    // Student.studentId    = "20-C0524"
    // =======================================================================

    if (rawStudentReference && studentsByStudentNumber.has(rawStudentReference)) {
      paidByStudentNumber[rawStudentReference] = (paidByStudentNumber[rawStudentReference] || 0) + paid;

      return;
    }

    // =======================================================================
    // 4. LAST RESORT:
    // Match by unique student name only.
    //
    // This is intentionally NOT used when multiple students have
    // the same name.
    // =======================================================================

    const collectionStudentName = String(c.student?.fullName || c.studentName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    if (collectionStudentName && studentNameCounts.get(collectionStudentName) === 1) {
      paidByUniqueStudentName[collectionStudentName] = (paidByUniqueStudentName[collectionStudentName] || 0) + paid;
    }
  });

  // =========================================================================
  // STUDENT ITEM OBLIGATIONS
  // =========================================================================

  const studentItemObligations: Record<string, Set<string>> = {};

  const addStudentObligation = (studentKey: string, itemName: string) => {
    if (!studentItemObligations[studentKey]) {
      studentItemObligations[studentKey] = new Set();
    }

    if (!studentItemObligations[studentKey].has(itemName)) {
      studentItemObligations[studentKey].add(itemName);

      return true;
    }

    return false;
  };

  // =========================================================================
  // PACKAGE STUDENT POPULATION
  // =========================================================================
  // Combine:
  // - all students in the organization
  // - valid students appearing in the selected AY/term enrollment
  //
  // Deduplicate by Student.id.
  // =========================================================================

  const packageStudentMap = new Map<string, any>();

  // Add all organization students.
  students.forEach((student: any) => {
    if (student?.id) {
      packageStudentMap.set(String(student.id), student);
    }
  });

  // Add valid enrolled students for the selected AY/term.
  enrollments
    .filter((enrollment: any) => {
      const status = String(enrollment.enrollmentStatus || '')
        .trim()
        .toUpperCase();

      return status !== 'DROPPED' && status !== 'CANCELLED' && status !== 'INACTIVE';
    })
    .forEach((enrollment: any) => {
      const student = enrollment?.student;

      if (student?.id) {
        packageStudentMap.set(String(student.id), student);
      }
    });

  const packageStudents = Array.from(packageStudentMap.values());

  // =========================================================================
  // PACKAGE RECEIVABLES
  // =========================================================================

  let unpaidOrPartialPackageCount = 0;

  let totalPackageReceivable = 0;

  packageStudents.forEach((student: any) => {
    if (!student?.id) {
      return;
    }

    const dbId = String(student.id).trim().toLowerCase();

    const studentNumber = String(student.studentId || '')
      .trim()
      .toLowerCase();

    const studentName = String(student.fullName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    // =====================================================================
    // DETERMINE PAYMENT TOTAL
    // =====================================================================

    let remitted = 0;

    // 1. Student.id
    if (dbId && paidByDbStudentId[dbId] !== undefined) {
      remitted = paidByDbStudentId[dbId];
    }

    // 2. Human-readable student number
    else if (studentNumber && paidByStudentNumber[studentNumber] !== undefined) {
      remitted = paidByStudentNumber[studentNumber];
    }

    // 3. Unique name
    else if (studentName && paidByUniqueStudentName[studentName] !== undefined) {
      remitted = paidByUniqueStudentName[studentName];
    }

    remitted = Math.round(remitted * 100) / 100;

    // =====================================================================
    // CALCULATE REMAINING PACKAGE BALANCE
    // =====================================================================

    const remaining = Math.max(0, Math.round((pkgTotal - remitted) * 100) / 100);

    // =====================================================================
    // ONLY UNPAID / PARTIAL STUDENTS APPEAR IN THE SUMMARY
    // =====================================================================

    if (remaining > 0) {
      unpaidOrPartialPackageCount += 1;

      totalPackageReceivable += remaining;

      addStudentObligation(`ID:${dbId}`, 'Departmental Fee');
    }
  });

  // =========================================================================
  // FINAL PACKAGE RECEIVABLE TOTAL
  // =========================================================================

  totalPackageReceivable = Math.round(totalPackageReceivable * 100) / 100;

  // =========================================================================
  // OTHER COLLECTION OBLIGATIONS
  // =========================================================================

  const collectiblesMap: Record<
    string,
    {
      category: string;
      headcount: number;
      total: number;
    }
  > = {};

  if (unpaidOrPartialPackageCount > 0) {
    collectiblesMap[`Unsettled Departmental Fees (${term})`] = {
      category: `Unsettled Departmental Fees (${term})`,
      headcount: unpaidOrPartialPackageCount,
      total: totalPackageReceivable,
    };
  }
  const explicitCollectibleItemKeys = new Set<string>();

  explicitCollectibles.forEach((ec: any) => {
    let rawCat = String(ec.category || 'Unassigned').trim();

    let itemName = rawCat;

    if (rawCat.startsWith('Arrears: ')) {
      const core = rawCat.substring(9);

      const dashIdx = core.lastIndexOf(' - ');

      itemName = dashIdx !== -1 ? core.substring(0, dashIdx).trim() : core;
    }

    const key = normalizeItemKey(itemName);

    if (key) {
      explicitCollectibleItemKeys.add(key);
    }
  });
  /*
   * Aggregate non-package obligations by student + item.
   *
   * This fixes an important problem in the previous engine:
   * an old partial-payment row could retain balanceDue even
   * after a later payment fully settled the item.
   */
  const obligationGroups = new Map<
    string,
    {
      studentKey: string;
      itemName: string;
      assessedAmount: number;
      paidAmount: number;
      hasOutstandingMarker: boolean;
    }
  >();

  validCollections.forEach((c: any) => {
    const desc = String(c.itemDescription || '').trim();

    const descLower = desc.toLowerCase();

    const isPackageItem = termPkg.items.some(
      (pi: any) =>
        String(pi.name || '')
          .trim()
          .toLowerCase() === descLower,
    );

    const isDepartmentalPackage =
      descLower === 'departmental fee package' ||
      descLower === 'departmental fee' ||
      descLower === 'departmental fee package (all items)';

    if (isPackageItem || isDepartmentalPackage) {
      return;
    }

    const category = String(c.category || '').trim();

    const itemName = desc || category || 'Other Due';
    if (explicitCollectibleItemKeys.has(normalizeItemKey(itemName))) {
      return;
    }

    const studentKey = getStudentKey(
      c.studentId || c.student?.id,
      c.student?.fullName || c.studentName,
      `UNKNOWN-${c.id}`,
    );

    const groupKey = `${studentKey}|${itemName.trim().toLowerCase()}`;

    const assessed = Number(c.standardRate) || 0;

    const paid = Number(c.amountPaid) || 0;

    const balance = Number(c.balanceDue) || 0;

    const paymentType = String(c.paymentType || '');

    const orNumber = String(c.orNumber || '');

    const outstandingMarker =
      balance > 0 || paymentType.toLowerCase().includes('unpaid') || orNumber.toUpperCase().startsWith('DUE-');

    const existing = obligationGroups.get(groupKey);

    if (existing) {
      existing.assessedAmount = Math.max(existing.assessedAmount, assessed);

      existing.paidAmount += paid;

      existing.hasOutstandingMarker = existing.hasOutstandingMarker || outstandingMarker;
    } else {
      obligationGroups.set(groupKey, {
        studentKey,
        itemName,
        assessedAmount: assessed,
        paidAmount: paid,
        hasOutstandingMarker: outstandingMarker,
      });
    }
  });

  obligationGroups.forEach((group) => {
    const remaining = Math.max(0, Math.round((group.assessedAmount - group.paidAmount) * 100) / 100);

    if (remaining <= 0 && !group.hasOutstandingMarker) {
      return;
    }

    const hasExistingStudentObligation = addStudentObligation(group.studentKey, group.itemName);

    if (!hasExistingStudentObligation) {
      return;
    }

    if (!collectiblesMap[group.itemName]) {
      collectiblesMap[group.itemName] = {
        category: group.itemName,
        headcount: 0,
        total: 0,
      };
    }

    collectiblesMap[group.itemName].headcount += 1;

    collectiblesMap[group.itemName].total += remaining > 0 ? remaining : group.assessedAmount;
  });

  // =========================================================================
  // EXPLICIT COLLECTIBLES
  // =========================================================================

  explicitCollectibles.forEach((ec: any) => {
    let rawCat = String(ec.category || 'Unassigned').trim();

    let itemName = rawCat;

    if (rawCat.startsWith('Arrears: ')) {
      const core = rawCat.substring(9);

      const dashIdx = core.lastIndexOf(' - ');

      itemName = dashIdx !== -1 ? core.substring(0, dashIdx).trim() : core;
    }

    const headcount = Number(ec.headcount) || 1;

    const total = Number(ec.balanceDue) || 0;

    if (!collectiblesMap[itemName]) {
      collectiblesMap[itemName] = {
        category: itemName,
        headcount: 0,
        total: 0,
      };
    }

    collectiblesMap[itemName].headcount += headcount;

    collectiblesMap[itemName].total += total;
  });

  const collectiblesList = Object.values(collectiblesMap);

  const totalCollectiblesSum = collectiblesList.reduce((sum, c) => sum + c.total, 0);

  // =========================================================================
  // INITIAL FUNDS
  // =========================================================================

  let totalInitialAlloc = 0;

  const initialAllocMap: Record<string, number> = {};

  initialFunds.forEach((f: any) => {
    const fundName = String(f.fundName || '').trim();

    if (!fundName) {
      return;
    }

    const initAmt = Number(f.initialAllocation) || 0;

    initialAllocMap[fundName] = (initialAllocMap[fundName] || 0) + initAmt;

    totalInitialAlloc += initAmt;
  });

  // =========================================================================
  // FUND TRANSFERS
  // =========================================================================

  const transferEffects: Record<string, number> = {};

  let carryOverInboundTotal = 0;

  fundTransfers.forEach((transfer: any) => {
    const amount = Number(transfer.amount) || 0;

    if (amount <= 0) {
      return;
    }

    const source = String(transfer.sourceFund || '').trim();

    const destination = String(transfer.destinationFund || '').trim();

    /*
     * carryOverTermBalance() stores records in the destination
     * accounting period and encodes the old period into sourceFund.
     *
     * Treat that as an inbound opening balance for this period,
     * not as a same-period transfer that nets back to zero.
     */
    const isCarryOver = source.toLowerCase().includes('rollover');

    if (isCarryOver) {
      if (destination) {
        transferEffects[destination] = (transferEffects[destination] || 0) + amount;
      }

      carryOverInboundTotal += amount;
      return;
    }

    if (source) {
      transferEffects[source] = (transferEffects[source] || 0) - amount;
    }

    if (destination) {
      transferEffects[destination] = (transferEffects[destination] || 0) + amount;
    }
  });

  const allFundNames = Array.from(
    new Set([
      ...Object.keys(collectionsByFund),
      ...Object.keys(expensesByFund),
      ...Object.keys(initialAllocMap),
      ...Object.keys(unliquidatedByFund),
      ...Object.keys(transferEffects),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const fundsList = allFundNames.map((name) => {
    const collected = collectionsByFund[name] || 0;

    const spent = expensesByFund[name] || 0;

    const init = initialAllocMap[name] || 0;

    const unliquidated = unliquidatedByFund[name] || 0;

    const transferEffect = transferEffects[name] || 0;

    const balance = init + collected - spent - unliquidated + transferEffect;

    return {
      name,
      collected,
      spent,
      unliquidated,
      balance,
    };
  });

  /*
   * Same-period transfers net to zero globally.
   * Carry-over is different: it belongs to this period,
   * so it is an actual inbound balance.
   */
  const remainingBalance =
    totalInitialAlloc + grandCollectionTotal - grandExpenseTotal - totalUnliquidated + carryOverInboundTotal;

  // =========================================================================
  // RETURN
  // =========================================================================

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
  };
}

// =========================================================================
// COLLECTION SETUP
// =========================================================================

export async function saveCollectionSetupItem(
  department: string,
  payload: {
    category: string;
    name: string;
    amount: number;
    targetFund: string;
    isPackage: boolean;
    ay: string;
    term: string;
  },
) {
  await requireTabAccess('tab-setup');

  const orgId = await getOrgId(department);

  const cleanCategory = String(payload.category || '').trim();

  const cleanName = String(payload.name || '').trim();

  const targetFund = String(payload.targetFund || '').trim();

  const amount = money(payload.amount, 'Collection setup amount');

  if (!cleanName) {
    throw new Error('Collection setup name is required.');
  }

  if (!targetFund) {
    throw new Error('Target fund is required.');
  }

  const existing = await prisma.collectionSetup.findFirst({
    where: {
      organizationId: orgId,
      academicYear: payload.ay,
      term: payload.term,
      name: cleanName,
    },
  });

  if (existing) {
    await prisma.collectionSetup.update({
      where: {
        id: existing.id,
      },
      data: {
        category: cleanCategory,
        amount,
        targetFund,
        isPackage: Boolean(payload.isPackage),
      },
    });
  } else {
    await prisma.collectionSetup.create({
      data: {
        organizationId: orgId,
        academicYear: payload.ay,
        term: payload.term,
        category: cleanCategory,
        name: cleanName,
        amount,
        targetFund,
        isPackage: Boolean(payload.isPackage),
      },
    });
  }

  revalidatePath(`/department/${department}/setup/collections`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);

  return {
    success: true,
    message: `Configured '${cleanName}' successfully.`,
  };
}

export async function deleteCollectionSetupItem(department: string, setupId: string) {
  await requireTabAccess('tab-setup');

  const orgId = await getOrgId(department);

  const existing = await prisma.collectionSetup.findFirst({
    where: {
      id: setupId,
      organizationId: orgId,
    },
  });

  if (!existing) {
    throw new Error('Collection setup item not found.');
  }

  await prisma.collectionSetup.deleteMany({
    where: {
      id: existing.id,
      organizationId: orgId,
    },
  });

  revalidatePath(`/department/${department}/setup/collections`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);

  return {
    success: true,
    message: 'Configuration item removed successfully.',
  };
}
