"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

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

export async function recordCashierRemittance(
  department: string,
  data: {
    date: string;
    remittedBy: string;
    fundSource: string;
    amount: number;
    cashierReceiptNo: string;
    remarks: string;
    ay: string;
    term: string;
  }
) {
  // Requires basic payment/treasury privileges
  const customUser = await requireTabAccess("tab-payment");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization not found.`);
  const orgId = organization.id;

  const amount = money(data.amount, "Remittance Amount");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");
  
  const date = parseDate(data.date, "remittance date");
  const remittanceId = generateReference("SAFE");

  await prisma.cashierRemittance.create({
    data: {
      organizationId: orgId,
      remittanceId,
      academicYear: data.ay,
      term: data.term,
      date,
      remittedBy: String(data.remittedBy).trim(),
      fundSource: String(data.fundSource).trim(),
      amount,
      cashierReceiptNo: String(data.cashierReceiptNo || "PENDING").trim(),
      remarks: String(data.remarks).trim(),
      status: "Remitted",
      encodedBy: officerName,
    }
  });

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "RECORD_CASHIER_REMITTANCE",
        details: `Deposited ₱${amount.toFixed(2)} from ${data.fundSource} to University Cashier for safekeeping.`,
      }
    });
  } catch (e) { console.warn("Log failed:", e); }

  revalidatePath(`/department/${department}/cashier-remittance`);
  revalidatePath(`/department/${department}/reports`);
}

export async function voidCashierRemittance(department: string, id: string) {
  const customUser = await requireTabAccess("tab-void");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization not found.`);
  
  // 🚀 FIX: Verify ownership first, then update using ONLY the unique ID
  const existing = await prisma.cashierRemittance.findFirst({
    where: { id, organizationId: organization.id }
  });

  if (!existing) throw new Error("Remittance record not found or access denied.");

  const record = await prisma.cashierRemittance.update({
    where: { id },
    data: { status: "Voided" }
  });

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: organization.id,
        user: officerName,
        action: "VOID_CASHIER_REMITTANCE",
        details: `Voided safekeeping turnover record [${record.remittanceId}].`,
      }
    });
  } catch (e) { console.warn("Log failed:", e); }

  revalidatePath(`/department/${department}/cashier-remittance`);
  revalidatePath(`/department/${department}/reports`);
}