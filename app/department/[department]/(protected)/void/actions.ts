// /app/department/[department]/(protected)/void/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireTabAccess } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';

export async function executeVoidTransaction(formData: {
  department: string;
  category: string;
  referenceId: string;
  reason: string;
}) {
  const { department, category, referenceId, reason } = formData;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  if (!reason || !reason.trim()) {
    throw new Error('Mandatory REASON is required to execute a transaction reversal.');
  }

  // 1. Verify Permission & Extract User Name
  const customUser = await requireTabAccess("tab-void", cleanDepartment);
  const officerName = customUser.name || customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${cleanDepartment}" not found.`);
  }

  let transactionDetails = '';
  let originalRecordId = '';
  let originalAmount = 0;

  // 2. Execute category-specific reversal without destructive in-place zeroing
  await prisma.$transaction(async (tx) => {
    if (category === 'collections') {
      const collection = await tx.collection.findFirst({
        where: { organizationId: organization.id, orNumber: referenceId },
      });
      if (!collection) throw new Error(`Official Receipt (OR) ${referenceId} not found.`);
      if (collection.status === 'VOID' || String(collection.paymentType).toUpperCase().includes('VOID')) {
        throw new Error(`OR Number ${referenceId} has already been voided.`);
      }

      originalRecordId = collection.id;
      originalAmount = Number(collection.amountPaid) || 0;

      await tx.collection.update({
        where: { id: collection.id },
        data: { 
          status: 'VOID', 
          paymentType: 'VOID (Reversed)',
        },
      });
      
      transactionDetails = `Voided Collection OR #${referenceId}. Reason: ${reason}`;
      
    } else if (category === 'penalties') {
      const penalty = await tx.penalty.findFirst({
        where: { organizationId: organization.id, penaltyId: referenceId },
      });
      if (!penalty) throw new Error(`Penalty ID ${referenceId} not found.`);

      originalRecordId = penalty.id;
      originalAmount = Number(penalty.fineAmount) || 0;

      await tx.penalty.update({
        where: { id: penalty.id },
        data: { status: `Voided: ${reason.trim()}` },
      });
      
      transactionDetails = `Voided Penalty #${referenceId}. Reason: ${reason}`;
      
    } else if (category === 'advances') {
      const ca = await tx.cashAdvance.findFirst({
        where: { organizationId: organization.id, advanceId: referenceId },
      });
      if (!ca) throw new Error(`Cash Advance ID ${referenceId} not found.`);
      if (String(ca.status || '').toLowerCase().includes('liquidated')) {
        throw new Error('Cannot void an already liquidated Cash Advance.');
      }

      originalRecordId = ca.id;
      // 🚀 FIX: Use amountApproved exclusively since amount does not exist on CashAdvance model
      originalAmount = Number(ca.amountApproved) || 0;

      await tx.cashAdvance.update({
        where: { id: ca.id },
        data: { status: `Cancelled: ${reason.trim()}` },
      });
      
      transactionDetails = `Cancelled Cash Advance #${referenceId}. Reason: ${reason}`;
      
    } else if (category === 'collectibles') {
      const collectible = await tx.collectible.findFirst({
        where: { organizationId: organization.id, id: referenceId },
      });
      if (!collectible) throw new Error(`Assessed Due reference not found.`);

      originalRecordId = collectible.id;
      originalAmount = Number(collectible.balanceDue) || 0;

      await tx.collectible.update({
        where: { id: collectible.id },
        data: { status: 'Voided', balanceDue: 0 },
      });
      
      transactionDetails = `Voided Collectible Assessment #${referenceId}. Reason: ${reason}`;
    }

    if ((tx as any).voidTransaction) {
      await (tx as any).voidTransaction.create({
        data: {
          organizationId: organization.id,
          category,
          referenceId,
          reason: reason.trim(),
          voidedBy: officerName,
          originalRecordId,
          amount: originalAmount
        }
      }).catch(() => {});
    }
  });

  // 3. Create System Audit Log
  await logSystemAction(
    organization.id,
    officerName,
    "VOID_TRANSACTION",
    transactionDetails
  );

  // 4. Revalidate Pages
  revalidatePath(`/department/${cleanDepartment}/void`);
  revalidatePath(`/department/${cleanDepartment}/logs`);
  revalidatePath(`/department/${cleanDepartment}`);
  
  return { success: true, message: `Transaction ${referenceId} successfully VOIDED.` };
}