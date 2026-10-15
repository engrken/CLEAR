// /app/department/[department]/(protected)/realign/actions.ts

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

// =========================================================================
// REALIGNMENT & CARRY-OVER ACTIONS
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
  }
) {
  // 1. Verify Permission
  const customUser = await requireTabAccess("tab-transfer");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
  const orgId = organization.id;

  // 3. Validate Inputs
  const amount = money(data.amount, "Transfer amount");

  if (amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  if (data.fromFund === data.toFund) {
    throw new Error("Source and destination fund accounts cannot be identical.");
  }

  // 4. Create Database Record
  await prisma.fundTransfer.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      sourceFund: String(data.fromFund || "").trim(),
      destinationFund: String(data.toFund || "").trim(),
      amount,
      reason: String(data.reason || "").trim(),
      encodedBy: officerName,
    },
  });

  // 5. Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "TRANSFER_FUNDS",
        details: `Realigned ₱${amount.toFixed(2)} from ${data.fromFund} to ${data.toFund}.`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 6. Revalidate Cache
  revalidatePath(`/department/${department}/realign`);
  revalidatePath(`/department/${department}`);
}

export async function carryOverTermBalance(
  department: string,
  data: {
    sourceAY: string;
    sourceTerm: string;
    destAY: string;
    destTerm: string;
    amount: number;
    reason: string;
  }
) {
  // 1. Verify Permission
  const customUser = await requireTabAccess("tab-transfer");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
  const orgId = organization.id;

  // 3. Validate Inputs
  const amount = money(data.amount, "Carry-over amount");

  if (amount <= 0) {
    throw new Error("Carry-over amount must be greater than zero.");
  }

  if (data.sourceAY === data.destAY && data.sourceTerm === data.destTerm) {
    throw new Error("Source and destination accounting periods must be different.");
  }

  // 4. Create Database Record
  await prisma.fundTransfer.create({
    data: {
      organizationId: orgId,
      academicYear: data.destAY,
      term: data.destTerm,
      sourceFund: `${String(data.sourceTerm).trim()} (${String(data.sourceAY).trim()}) Rollover`,
      destinationFund: "General Fund (Carried Over)",
      amount,
      reason: String(data.reason || "").trim(),
      encodedBy: officerName,
    },
  });

  // 5. Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "CARRY_OVER",
        details: `Carried over ₱${amount.toFixed(2)} from ${data.sourceTerm} into ${data.destTerm} General Fund.`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 6. Revalidate Cache
  revalidatePath(`/department/${department}/realign`);
  revalidatePath(`/department/${department}`);
}