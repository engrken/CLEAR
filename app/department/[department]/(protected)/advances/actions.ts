// /app/department/[department]/(protected)/advances/actions.ts

"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

// Safe money parser
function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return parsed;
}

// Safe date parser
function parseDate(val: any, fieldName: string): Date {
  const date = new Date(val);
  if (isNaN(date.getTime())) throw new Error(`Invalid date format for ${fieldName}`);
  return date;
}

// Generate unique reference ID
function generateReference(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${randomStr}-${timestamp}`;
}

// =========================================================================
// CASH ADVANCE ACTIONS
// =========================================================================

export async function issueCashAdvance(
  department: string,
  data: {
    requestor: string;
    purpose: string;
    fundSource: string;
    amount: number;
    dateIssued: string;
    expectedReturnDate: string;
    ay: string;
    term: string;
  }
) {
  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-advances");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${department}" not found.`);
  }

  const orgId = organization.id;

  // 3. Validate Inputs
  const amount = money(data.amount, "Cash advance amount");

  if (amount <= 0) {
    throw new Error("Cash advance amount must be greater than zero.");
  }

  const dateIssued = parseDate(data.dateIssued, "date issued");
  const expectedReturnDate = parseDate(data.expectedReturnDate, "expected return date");
  const advanceId = generateReference("CA");

  // 4. Create Database Record
  await prisma.cashAdvance.create({
    data: {
      organizationId: orgId,
      advanceId,
      academicYear: data.ay,
      term: data.term,
      requestor: String(data.requestor || "").trim(),
      purpose: String(data.purpose || "").trim() || null,
      fundSource: String(data.fundSource || "").trim(),
      amountApproved: amount,
      dateIssued,
      expectedReturnDate,
      status: "Pending Liquidation",
      encodedBy: officerName,
    },
  });

  // 5. Audit Log (If SystemLog table exists)
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "ISSUE_ADVANCE",
        details: `Issued ₱${amount.toFixed(2)} cash advance [${advanceId}] to ${data.requestor} from ${data.fundSource}.`,
      }
    });
  } catch (error) {
    console.warn("System logging failed (table might not exist yet):", error);
  }

  // 6. Revalidate Cache
  revalidatePath(`/department/${department}/advances`);
  revalidatePath(`/department/${department}`);
  revalidatePath(`/department/${department}/liquidations`);
}