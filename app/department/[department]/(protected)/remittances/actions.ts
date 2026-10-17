// /app/department/[department]/(protected)/remittances/actions.ts

"use server";

import { requireDepartmentAccess, normalizeDepartmentSlug } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  createOnlineRemittance,
  invalidateOnlineRemittanceFor,
  proofFileToDataUrl,
  verifyOnlineRemittanceFor,
  assertProofSubmissionAllowed,
  recordProofSubmission,
} from '@/lib/remittances';
import { headers } from 'next/headers';
import { clientIp } from '@/lib/request-ip';

// The rules live in lib/remittances.ts (shared with the mobile API); these
// actions add the web session guard and cache revalidation.

function revalidateQueue(department: string) {
  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);
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
  const { user, org } = await requireDepartmentAccess("tab-remittances", department);
  const officerName = user.fullName || user.email || "System Administrator";

  await verifyOnlineRemittanceFor(org.id, officerName, {
    remittanceId: data.remittanceId,
    orNumber: data.orNumber,
    fundAllocation: data.fundAllocation,
  });

  revalidateQueue(org.subdomain);
}

export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  const { user, org } = await requireDepartmentAccess("tab-remittances", department);
  const officerName = user.fullName || user.email || "System Administrator";

  await invalidateOnlineRemittanceFor(org.id, officerName, remittanceId);

  revalidatePath(`/department/${org.subdomain}/remittances`);
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
  const cleanDepartment = normalizeDepartmentSlug(department);
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
      proofBase64: await proofFileToDataUrl(formData.get('receipt') as File | null),
    };
  } else {
    data = payload as Exclude<typeof payload, FormData>;
  }

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });
  if (!organization) throw new Error(`Organization "${cleanDepartment}" not found.`);
  const ip = clientIp(await headers());
  await assertProofSubmissionAllowed(organization.id, ip);

  // The web form collects an email for the receipt; the mobile app falls back to the roster.
  const cleanEmail = String(data.email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) throw new Error("Please provide a valid email address.");

  await createOnlineRemittance(organization.id, {
    studentId: data.studentId,
    studentName: data.studentName,
    email: cleanEmail,
    paymentChannel: data.paymentChannel,
    referenceNo: data.referenceNo,
    particulars: data.particulars,
    amount: data.amount,
    proofDataUrl: data.proofBase64,
    ay: data.ay,
    term: data.term,
  });
  await recordProofSubmission(organization.id, ip);

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
