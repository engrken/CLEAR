// /app/department/[department]/(protected)/remittances/actions.ts

"use server";

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return Math.round(parsed * 100) / 100;
}

function generateReference(prefix: string): string {
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${randomStr}-${timestamp}`;
}

// Public payment-proof uploads: images only, capped in size (validated server-side;
// the browser's accept="image/*" is only a hint).
const MAX_PROOF_BYTES = 4 * 1024 * 1024;
const PROOF_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function validateProofDataUrl(dataUrl: string | null | undefined): string | null {
  if (!dataUrl) return null;
  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=s]+)$/i.exec(String(dataUrl));
  if (!match || !PROOF_MIME_TYPES.has(match[1].toLowerCase())) {
    throw new Error('Payment proof must be a PNG, JPEG, WebP or GIF image.');
  }
  const bytes = Buffer.byteLength(match[2].replace(/s/g, ''), 'base64');
  if (bytes > MAX_PROOF_BYTES) {
    throw new Error('Payment proof image must be 4 MB or smaller.');
  }
  return dataUrl;
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

    // 🚀 FIX: Resolve student UUID properly to avoid foreign-key constraint violations
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
// PUBLIC SUBMISSION ENDPOINTS (NO AUTH REQUIRED)
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
    if (receiptFile && receiptFile.size > 0) {
      if (!PROOF_MIME_TYPES.has(receiptFile.type)) {
        throw new Error('Payment proof must be a PNG, JPEG, WebP or GIF image.');
      }
      if (receiptFile.size > MAX_PROOF_BYTES) {
        throw new Error('Payment proof image must be 4 MB or smaller.');
      }
      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      data.proofBase64 = `data:${receiptFile.type};base64,${buffer.toString('base64')}`;
    }
  } else {
    data = payload as any;
  }

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });
  if (!organization) throw new Error(`Organization "${cleanDepartment}" not found.`);
  const orgId = organization.id;

  data.proofBase64 = validateProofDataUrl(data.proofBase64);
  if (!String(data.studentName || "").trim() || !String(data.referenceNo || "").trim()) {
    throw new Error("Student name and payment reference number are required.");
  }

  const cleanEmail = String(data.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Please provide a valid email address.");

  const amount = money(data.amount, "Online remittance amount");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  const submissionId = generateReference("SUB");

  await prisma.onlineRemittance.create({
    data: {
      organizationId: orgId,
      submissionId,
      academicYear: data.ay,
      term: data.term,
      studentId: String(data.studentId || "").trim() || null,
      studentName: String(data.studentName || "").trim(),
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