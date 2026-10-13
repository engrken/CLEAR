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
    type: string; // "Deposit" or "Withdrawal"
    amount: number;
    cashierReceiptNo: string;
    remarks: string;
    ay: string;
    term: string;
  }
) {
  const customUser = await requireTabAccess("tab-payment");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization not found.`);
  const orgId = organization.id;

  const amount = money(data.amount, "Transaction Amount");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");
  
  const date = parseDate(data.date, "transaction date");
  const remittanceId = generateReference(data.type === "Withdrawal" ? "WITH" : "SAFE");

  await prisma.cashierRemittance.create({
    data: {
      organizationId: orgId,
      remittanceId,
      academicYear: data.ay,
      term: data.term,
      date,
      remittedBy: String(data.remittedBy).trim(),
      fundSource: String(data.fundSource).trim(),
      type: data.type,
      amount,
      cashierReceiptNo: String(data.cashierReceiptNo || "PENDING").trim(),
      remarks: String(data.remarks).trim(),
      status: "Remitted", // We keep "Remitted" to mean "Valid/Processed"
      encodedBy: officerName,
    }
  });

  try {
    const logAction = data.type === "Withdrawal" ? "Withdrew" : "Deposited";
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: `RECORD_CASHIER_${data.type.toUpperCase()}`,
        details: `${logAction} ₱${amount.toFixed(2)} (${data.fundSource}) via University Cashier.`,
      }
    });
  } catch (e) { console.warn("Log failed:", e); }

  revalidatePath(`/department/${department}/cashier-remittance`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/summary`);
  revalidatePath(`/department/${department}`);

  return { success: true, remittanceId };
}

export async function voidCashierRemittance(department: string, id: string) {
  const customUser = await requireTabAccess("tab-void");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization not found.`);
  
  const existing = await prisma.cashierRemittance.findFirst({
    where: { id, organizationId: organization.id }
  });

  if (!existing) throw new Error("Record not found or access denied.");

  const record = await prisma.cashierRemittance.update({
    where: { id },
    data: { status: "Voided" }
  });

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: organization.id,
        user: officerName,
        action: "VOID_CASHIER_TRANSACTION",
        details: `Voided cashier transaction record [${record.remittanceId}].`,
      }
    });
  } catch (e) { console.warn("Log failed:", e); }

  revalidatePath(`/department/${department}/cashier-remittance`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/summary`);
  revalidatePath(`/department/${department}`);
}