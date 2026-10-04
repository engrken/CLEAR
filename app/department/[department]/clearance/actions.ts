'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function submitOnlineRemittanceDirect(department: string, payload: {
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
}) {
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Department "${department}" not found.`);
  }

  const submissionId = `REM-${Date.now().toString().slice(-8)}`;

  await prisma.onlineRemittance.create({
    data: {
      organizationId: organization.id,
      submissionId,
      academicYear: payload.ay,
      term: payload.term,
      studentId: payload.studentId,
      studentName: payload.studentName,
      studentEmail: payload.email,
      paymentChannel: payload.channel,
      referenceNumber: payload.referenceNo,
      category: payload.collectionType,
      itemDescription: payload.collectionType,
      paymentMode: payload.paymentMode,
      amountPaid: payload.amount,
      proofUrl: payload.proofBase64,
      status: 'Pending', // FIXED: Matches the queue filter exactly
    },
  });

  revalidatePath(`/department/${department}/remittances`);
  return { success: true, message: `Remittance successfully queued! ID: ${submissionId}` };
}