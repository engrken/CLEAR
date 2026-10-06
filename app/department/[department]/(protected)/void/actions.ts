'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

function sha256Hex(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function executeVoidTransaction(formData: {
  department: string;
  category: string;
  referenceId: string;
  reason: string;
  pin?: string;
}) {
  const { department, category, referenceId, reason, pin } = formData;

  if (!reason || !reason.trim()) {
    throw new Error('Mandatory REASON is required to execute a transaction reversal.');
  }

  // Master PIN validation check (Default Master PIN hash matches LIVE_code.gs: 999999)
  if (pin) {
    const hashedPin = sha256Hex(pin.trim());
    const expectedPinHash = sha256Hex('999999');
    if (hashedPin !== expectedPinHash) {
      throw new Error('Invalid Master Void Authorization PIN[cite: 17].');
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${department}" not found.`);
  }

  // Execute category-specific reversal mirroring LIVE_code.gs handlers
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
  } else if (category === 'penalties') {
    const penalty = await prisma.penalty.findFirst({
      where: { organizationId: organization.id, penaltyId: referenceId },
    });
    if (!penalty) throw new Error(`Penalty ID ${referenceId} not found.`);

    await prisma.penalty.update({
      where: { id: penalty.id },
      data: { status: `Voided: ${reason.trim()}` },
    });
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
  } else if (category === 'collectibles') {
    const collectible = await prisma.collectible.findFirst({
      where: { organizationId: organization.id, id: referenceId },
    });
    if (!collectible) throw new Error(`Assessed Due reference not found.`);

    await prisma.collectible.update({
      where: { id: collectible.id },
      data: { status: 'Voided', balanceDue: 0 },
    });
  }

  revalidatePath(`/department/${department}/void`);
  return { success: true, message: `Transaction ${referenceId} successfully VOIDED[cite: 12, 17].` };
}