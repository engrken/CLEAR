// /app/department/[department]/(protected)/liquidations/actions.ts

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

// =========================================================================
// AUDIT / LIQUIDATION ACTIONS
// =========================================================================

export async function recordAudit(
  department: string,
  data: {
    date: string;
    advanceId: string;
    requestor: string;
    fundSource: string;
    budgetRequested: number;
    totalExpense: number;
    items: {
      qty: number;
      orsi: string;
      desc: string;
      subTotal: number;
      proofBase64?: string; // 🚀 ADDED SUPPORT FOR BLOB ATTACHMENTS
      proofMime?: string;
    }[];
    ay: string;
    term: string;
  }
) {
  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-audit");
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
  const date = parseDate(data.date, "audit date");
  const budgetRequested = money(data.budgetRequested, "Budget requested");
  const totalExpense = money(data.totalExpense, "Total expense");

  if (totalExpense <= 0) {
    throw new Error("Total expense must be greater than zero.");
  }

  if (!Array.isArray(data.items)) {
    throw new Error("Expense items are invalid.");
  }

  // 4. Validate Items & Re-calculate Total
  let itemTotal = 0;

  for (const item of data.items) {
    const qty = Number(item.qty);
    const subTotal = money(item.subTotal, "Expense subtotal");

    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Expense quantity must be a positive whole number.");
    }
    itemTotal += subTotal;
  }

  itemTotal = Math.round(itemTotal * 100) / 100;

  if (Math.abs(itemTotal - totalExpense) > 0.01) {
    throw new Error(`Expense item total ₱${itemTotal.toFixed(2)} does not match total expense ₱${totalExpense.toFixed(2)}.`);
  }

  // 5. Calculate Variances
  const auditId = generateReference("AUD");
  const variance = Math.round((budgetRequested - totalExpense) * 100) / 100;
  const cashReturn = variance > 0 ? variance : 0;
  const reimbursement = variance < 0 ? Math.abs(variance) : 0;
  const caRef = data.advanceId || "Direct Expense (No CA)";

  // 6. Execute Database Transaction
  await prisma.$transaction(async (tx) => {
    // Check if linked to an Advance
    if (data.advanceId) {
      const advance = await tx.cashAdvance.findFirst({
        where: { organizationId: orgId, advanceId: data.advanceId },
      });

      if (!advance) throw new Error("Cash advance record not found.");
      
      const status = String(advance.status || "").toUpperCase();
      if (status.includes("LIQUIDATED")) {
        throw new Error("This cash advance has already been liquidated.");
      }
    }

    // Create Audit Header
    await tx.audit.create({
      data: {
        organizationId: orgId,
        auditId,
        academicYear: data.ay,
        term: data.term,
        date,
        referenceCaId: caRef,
        requestor: String(data.requestor || "").trim(),
        fundSource: String(data.fundSource || "").trim(),
        budgetRequested,
        totalExpense,
        varianceReturn: cashReturn,
        reimbursementDue: reimbursement,
        status: "Audited & Verified",
        encodedBy: officerName,
      },
    });

    // Create Expense Items with Receipt Proof Blob URLs
    for (const item of data.items) {
      await tx.expenseItem.create({
        data: {
          organizationId: orgId,
          auditId,
          orSiNumber: String(item.orsi || "").trim() || null,
          qty: Number(item.qty),
          description: String(item.desc || "").trim(),
          subTotal: money(item.subTotal, "Expense subtotal"),
          receiptProofUrl: item.proofBase64 || null, // 🚀 SAVES THE ATTACHED BLOB TO THE DATABASE
        },
      });
    }

    // Update Cash Advance Status (if applicable)
    if (data.advanceId) {
      const advance = await tx.cashAdvance.findFirst({
        where: { organizationId: orgId, advanceId: data.advanceId },
      });

      if (advance) {
        await tx.cashAdvance.update({
          where: { id: advance.id },
          data: { status: "Liquidated" },
        });
      }
    }
  });

  // 7. Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "RECORD_LIQUIDATION",
        details: `Verified liquidation [${auditId}] for ${data.requestor} totaling ₱${totalExpense.toFixed(2)}.`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 8. Revalidate Cache
  revalidatePath(`/department/${department}/liquidations`);
  revalidatePath(`/department/${department}`);
}