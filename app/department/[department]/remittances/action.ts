'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Department "${department}" not found.`);
  }

  // Option A: Delete the invalid submission entirely from the queue
  await prisma.onlineRemittance.delete({
    where: { id: remittanceId, organizationId: organization.id },
  });

  // Alternatively, if you prefer to update status instead of deleting:
  /*
  await prisma.onlineRemittance.update({
    where: { id: remittanceId, organizationId: organization.id },
    data: { status: 'Invalid' },
  });
  */

  revalidatePath(`/department/${department}/remittances`);
  return { success: true, message: 'Remittance submission marked as invalid and removed from queue.' };
}