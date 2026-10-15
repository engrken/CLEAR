// /app/department/[department]/(protected)/void/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireTabAccess } from '@/lib/permissions';

export async function executeVoidTransaction(formData: {
  department: string;
  category: string;
  referenceId: string;
  reason: string;
}) {
  const { department, category, referenceId, reason } = formData;

  if (!reason || !reason.trim()) {
    throw new Error('Mandatory REASON is required to execute a transaction reversal.');
  }

  // 1. Verify Permission & Extract User Name
  const customUser = await requireTabAccess("tab-void");
  // Prioritize .name (NextAuth default) to prevent falling back to the email
  const officerName = customUser.name || customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${department}" not found.`);
  }

  let transactionDetails = '';

  // 2. Execute category-specific reversal
  if (category === 'collections') {
    const collection = await prisma.collection.findFirst({
      where: { organizationId: organization.id, orNumber: referenceId },
    });
    if (!collection) throw new Error(`Official Receipt (OR) ${referenceId} not found.`);
    if (collection.status === 'VOID') throw new Error(`OR Number ${referenceId} has already been voided.`);

    await prisma.collection.update({
      where: { id: collection.id },
      data: { status: 'VOID', itemDescription: `VOID: ${reason.trim()}`, amountPaid: 0, balanceDue: 0 },
    });
    
    transactionDetails = `Voided Collection OR #${referenceId}. Reason: ${reason}`;
    
  } else if (category === 'penalties') {
    const penalty = await prisma.penalty.findFirst({
      where: { organizationId: organization.id, penaltyId: referenceId },
    });
    if (!penalty) throw new Error(`Penalty ID ${referenceId} not found.`);

    await prisma.penalty.update({
      where: { id: penalty.id },
      data: { status: `Voided: ${reason.trim()}` },
    });
    
    transactionDetails = `Voided Penalty #${referenceId}. Reason: ${reason}`;
    
  } else if (category === 'advances') {
    const ca = await prisma.cashAdvance.findFirst({
      where: { organizationId: organization.id, advanceId: referenceId },
    });
    if (!ca) throw new Error(`Cash Advance ID ${referenceId} not found.`);
    if (ca.status.includes('Liquidated')) throw new Error('Cannot void an already liquidated Cash Advance.');

    await prisma.cashAdvance.update({
      where: { id: ca.id },
      data: { status: `Cancelled: ${reason.trim()}` },
    });
    
    transactionDetails = `Cancelled Cash Advance #${referenceId}. Reason: ${reason}`;
    
  } else if (category === 'collectibles') {
    const collectible = await prisma.collectible.findFirst({
      where: { organizationId: organization.id, id: referenceId },
    });
    if (!collectible) throw new Error(`Assessed Due reference not found.`);

    await prisma.collectible.update({
      where: { id: collectible.id },
      data: { status: 'Voided', balanceDue: 0 },
    });
    
    transactionDetails = `Voided Collectible Assessment #${referenceId}. Reason: ${reason}`;
  }

  // 3. Create System Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: organization.id,
        user: officerName,
        action: "VOID_TRANSACTION",
        details: transactionDetails,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 4. Revalidate Pages
  revalidatePath(`/department/${department}/void`);
  revalidatePath(`/department/${department}/logs`);
  revalidatePath(`/department/${department}`);
  
  return { success: true, message: `Transaction ${referenceId} successfully VOIDED.` };
}