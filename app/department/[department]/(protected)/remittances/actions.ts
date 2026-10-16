// /app/department/[department]/(protected)/remittances/actions.ts

"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

// =========================================================================
// SECURITY CONFIGURATIONS FOR PUBLIC SUBMISSION
// =========================================================================
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window
const MAX_SUBMISSIONS_IN_WINDOW = 5; // Max 5 submissions per IP in 10 mins

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return Math.round(parsed * 100) / 100;
}

function generateReference(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${randomStr}-${timestamp}`;
}

async function resolveStudentDbId(orgId: string, identifier: string | null) {
  if (!identifier) return null;

  let student = await prisma.student.findFirst({
    where: { id: identifier, organizationId: orgId }
  });

  if (!student) {
    student = await prisma.student.findFirst({
      where: { studentId: identifier, organizationId: orgId }
    });
  }

  return student ? student.id : null;
}

// =========================================================================
// ONLINE REMITTANCE (QUEUE VERIFICATION)
// =========================================================================

export async function verifyOnlineRemittance(
  department: string,
  data: {
    remittanceId: string;
    orNumber: string;
    studentId: string;
    studentName: string;
    particulars: string;
    amount: number;
    ay: string;
    term: string;
    fundAllocation: string;
  }
) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const customUser = await requireTabAccess("tab-remittances", cleanDepartment);
  const officerName = customUser.name || customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });
  if (!organization) throw new Error(`Organization subdomain "${cleanDepartment}" not found.`);
  const orgId = organization.id;

  const orNumber = String(data.orNumber || "").trim();
  if (!orNumber) throw new Error("OR number is required.");

  await prisma.$transaction(async (tx) => {
    const remittance = await tx.onlineRemittance.findFirst({
      where: { id: data.remittanceId, organizationId: orgId },
    });

    if (!remittance) throw new Error("Online remittance record not found.");
    if (String(remittance.status || "").toUpperCase() === "VERIFIED") throw new Error("This remittance has already been verified.");

    const amount = Math.max(0, Number(remittance.amountPaid) || 0);
    if (amount <= 0) throw new Error("The remittance contains an invalid amount.");

    const studentDbId = await resolveStudentDbId(orgId, remittance.studentId);

    await tx.onlineRemittance.update({
      where: { id: remittance.id },
      data: { status: "Verified", reviewedBy: officerName, orNumber },
    });

    await tx.collection.create({
      data: {
        organizationId: orgId,
        academicYear: remittance.academicYear,
        term: remittance.term,
        date: new Date(),
        studentId: studentDbId,
        studentName: remittance.studentName,
        orNumber,
        category: remittance.category || "Online Remittance",
        itemDescription: remittance.itemDescription || "Online Payment",
        paymentType: "Full Payment",
        standardRate: amount,
        amountPaid: amount,
        balanceDue: 0,
        fundAllocation: data.fundAllocation,
        status: "Valid",
        encodedBy: officerName,
      },
    });
  });

  await logSystemAction(
    orgId,
    officerName,
    "VERIFY_REMITTANCE",
    `Verified online remittance [${data.remittanceId}] and issued OR: ${orNumber}.`
  );

  revalidatePath(`/department/${cleanDepartment}/remittances`);
  revalidatePath(`/department/${cleanDepartment}/collections`);
  revalidatePath(`/department/${cleanDepartment}/clearance`);
  revalidatePath(`/department/${cleanDepartment}`);
}

export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const customUser = await requireTabAccess("tab-remittances", cleanDepartment);
  const officerName = customUser.name || customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });
  if (!organization) throw new Error(`Organization "${cleanDepartment}" not found.`);
  const orgId = organization.id;

  const remittance = await prisma.onlineRemittance.findFirst({
    where: { id: remittanceId, organizationId: orgId },
  });

  if (!remittance) throw new Error("Online remittance record not found.");

  if (String(remittance.status || "").toUpperCase() === "VERIFIED") {
    throw new Error("A verified remittance cannot be invalidated from the pending queue.");
  }

  await prisma.onlineRemittance.update({
    where: { id: remittance.id },
    data: {
      status: "Rejected",
      reviewedBy: officerName,
      reviewNotes: "Marked invalid and removed from queue by admin."
    }
  });

  await logSystemAction(
    orgId,
    officerName,
    "INVALIDATE_REMITTANCE",
    `Invalidated remittance [Ref: ${remittance.referenceNumber}] from ${remittance.studentName}.`
  );

  revalidatePath(`/department/${cleanDepartment}/remittances`);

  return { success: true, message: "Remittance submission marked as invalid and moved to Rejected tab." };
}

// =========================================================================
// PUBLIC SUBMISSION ENDPOINTS (HARDENED WITH RATE LIMITING & VALIDATION)
// =========================================================================

export async function submitOnlineRemittance(
  department: string,
  payload: FormData | {
    studentId: string;
    studentName: string;
    email: string;
    paymentChannel: string;
    referenceNo: string;
    particulars: string;
    amount: number;
    proofBase64: string | null;
    ay: string;
    term: string;
  }
) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });
  if (!organization) throw new Error(`Organization "${cleanDepartment}" not found.`);
  const orgId = organization.id;

  // =========================================================
  // 1. IP-BASED RATE LIMITING (Using AuthThrottle Model)
  // =========================================================
  const headersList = await headers();
  const clientIp = headersList.get('x-forwarded-for') || 'unknown';
  const throttleKey = `public_remit_${orgId}_${clientIp}`;

  const now = new Date();
  const windowStartThreshold = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  let throttle = await prisma.authThrottle.findUnique({
    where: { key: throttleKey },
  });

  if (throttle) {
    const lastSent = throttle.lastSentAt ? new Date(throttle.lastSentAt) : null;
    if (lastSent && lastSent > windowStartThreshold) {
      if (throttle.failedCount >= MAX_SUBMISSIONS_IN_WINDOW) {
        throw new Error('Too many payment proof submissions from your network. Please wait 10 minutes before trying again.');
      }
      await prisma.authThrottle.update({
        where: { key: throttleKey },
        data: { failedCount: throttle.failedCount + 1, updatedAt: now },
      });
    } else {
      await prisma.authThrottle.update({
        where: { key: throttleKey },
        data: { failedCount: 1, lastSentAt: now, updatedAt: now },
      });
    }
  } else {
    await prisma.authThrottle.create({
      data: {
        key: throttleKey,
        failedCount: 1,
        lastSentAt: now,
        updatedAt: now,
      },
    });
  }

  // =========================================================
  // 2. PARSE PAYLOAD & VALIDATE FILES (IF FORMDATA)
  // =========================================================
  let data;
  if (typeof (payload as FormData).get === 'function') {
    const formData = payload as FormData;
    data = {
      studentId: formData.get('studentId') as string,
      studentName: formData.get('studentName') as string,
      email: formData.get('email') as string,
      paymentChannel: formData.get('paymentChannel') as string,
      referenceNo: formData.get('referenceNo') as string,
      particulars: formData.get('particulars') as string,
      amount: parseFloat(formData.get('amount') as string),
      ay: formData.get('ay') as string,
      term: formData.get('term') as string,
      proofBase64: null as string | null,
    };

    const receiptFile = formData.get('receipt') as File | null;
    if (receiptFile) {
      if (receiptFile.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds the 5MB maximum limit. Please upload a smaller image.');
      }
      if (!ALLOWED_MIME_TYPES.includes(receiptFile.type.toLowerCase())) {
        throw new Error('Invalid file format. Only JPEG, PNG, and WebP receipt images are permitted.');
      }

      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      data.proofBase64 = `data:${receiptFile.type};base64,${buffer.toString('base64')}`;
    }
  } else {
    data = payload as any;
  }

  // =========================================================
  // 3. FIELD VALIDATIONS & SANITIZATION
  // =========================================================
  const cleanEmail = String(data.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Please provide a valid email address.");

  const amount = money(data.amount, "Online remittance amount");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  const targetStudentId = String(data.studentId || "").trim();
  if (!targetStudentId) throw new Error("Student ID is required.");

  // =========================================================
  // 4. STUDENT EXISTENCE CHECK IN ORGANIZATION ROSTER
  // =========================================================
  const studentExists = await prisma.student.findFirst({
    where: {
      organizationId: orgId,
      studentId: { equals: targetStudentId, mode: 'insensitive' },
    },
  });

  if (!studentExists) {
    throw new Error(`Student ID "${targetStudentId}" is not registered under this department. Please verify your student ID.`);
  }

  const submissionId = generateReference("SUB");

  await prisma.onlineRemittance.create({
    data: {
      organizationId: orgId,
      submissionId,
      academicYear: data.ay,
      term: data.term,
      studentId: targetStudentId,
      studentName: String(data.studentName || studentExists.fullName).trim(),
      studentEmail: cleanEmail,
      paymentChannel: String(data.paymentChannel || "").trim(),
      referenceNumber: String(data.referenceNo || "").trim(),
      category: "Online Remittance",
      itemDescription: String(data.particulars || "").trim(),
      paymentMode: "Online",
      amountPaid: amount,
      proofUrl: data.proofBase64 || null,
      status: "Pending Verification",
    },
  });

  await logSystemAction(
    orgId,
    "Public Submission",
    "SUBMIT_REMITTANCE",
    `Received ₱${amount.toFixed(2)} online payment proof from ${data.studentName} via ${data.paymentChannel}.`
  );

  revalidatePath(`/department/${cleanDepartment}/remittances`);
  revalidatePath(`/department/${cleanDepartment}/clearance`);

  return { success: true, message: "Payment proof submitted successfully." };
}

export async function submitOnlineRemittanceDirect(
  department: string,
  payload: {
    studentId: string;
    studentName: string;
    email: string;
    channel: string;
    referenceNo: string;
    collectionType: string;
    paymentMode: string;
    amount: number;
    proofBase64: string;
    ay: string;
    term: string;
  }
) {
  return submitOnlineRemittance(department, {
    studentId: payload.studentId,
    studentName: payload.studentName,
    email: payload.email,
    paymentChannel: payload.channel,
    referenceNo: payload.referenceNo,
    particulars: payload.collectionType,
    amount: payload.amount,
    proofBase64: payload.proofBase64,
    ay: payload.ay,
    term: payload.term,
  });
}