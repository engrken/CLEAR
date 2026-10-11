// /(protected)/remittances/actions.ts


"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return parsed;
}

function parseDate(val: any, fieldName: string): Date {
  const date = new Date(val);
  if (isNaN(date.getTime())) throw new Error(`Invalid date format for ${fieldName}`);
  return date;
}

function generateReference(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${randomStr}-${timestamp}`;
}

// Public Helper: Resolves Org ID without requiring an active session
async function resolveOrganizationId(department: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!org) throw new Error(`Organization "${department}" not found.`);
  return org.id;
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
    fundAllocation: string; // <--- ADDED THIS
  }
) {
  const customUser = await requireTabAccess("tab-remittances");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
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

    const studentDbId = remittance.studentId ? String(remittance.studentId).trim() : null;

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
        fundAllocation: data.fundAllocation, // <--- NOW DYNAMICALLY ASSIGNED
        status: "Valid",
        encodedBy: officerName,
      },
    });
  });

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "VERIFY_REMITTANCE",
        details: `Verified online remittance [${data.remittanceId}] and issued OR: ${orNumber}.`,
      }
    });
  } catch (e) { console.warn(e); }

  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);
}

export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  const customUser = await requireTabAccess("tab-remittances");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const orgId = await resolveOrganizationId(department);

  const remittance = await prisma.onlineRemittance.findFirst({
    where: { id: remittanceId, organizationId: orgId },
  });

  if (!remittance) throw new Error("Online remittance record not found.");

  if (String(remittance.status || "").toUpperCase() === "VERIFIED") {
    throw new Error("A verified remittance cannot be invalidated from the pending queue.");
  }

  // FIX APPLIED: Update status to "Rejected" instead of permanently deleting the record
  await prisma.onlineRemittance.update({
    where: { id: remittance.id },
    data: {
      status: "Rejected",
      reviewedBy: officerName,
      reviewNotes: "Marked invalid and removed from queue by admin."
    }
  });

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "INVALIDATE_REMITTANCE",
        details: `Invalidated remittance [Ref: ${remittance.referenceNumber}] from ${remittance.studentName}.`,
      }
    });
  } catch (e) { console.warn(e); }

  revalidatePath(`/department/${department}/remittances`);

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
      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      data.proofBase64 = `data:${receiptFile.type};base64,${buffer.toString('base64')}`;
    }
  } else {
    data = payload as any;
  }

  const orgId = await resolveOrganizationId(department);
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

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: "Public Submission",
        action: "SUBMIT_REMITTANCE",
        details: `Received ₱${amount.toFixed(2)} online payment proof from ${data.studentName} via ${data.paymentChannel}.`,
      }
    });
  } catch (e) { console.warn(e); }

  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/clearance`);
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