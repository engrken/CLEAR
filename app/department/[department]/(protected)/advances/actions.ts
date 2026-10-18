"use server";

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPeriodLedger, toCents } from "../realign/ledger";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";
import { enqueueAccountingNotice, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";

function parseMoney(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error("Cash advance amount must be a positive, finite number.");
  }
  if (Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) {
    throw new Error("Amount may contain at most two decimal places.");
  }
  return Math.round(n * 100) / 100;
}

function validateDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be YYYY-MM-DD.`);
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${field}.`);
  }
  return date;
}

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
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const officer = await requireTabAccess("tab-advances", cleanDepartment);
  const officerName = String(officer.name || officer.fullName || officer.email || "System Administrator");
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }, select: { id: true },
  });
  if (!organization) throw new Error("Department not found.");

  const ay = String(data.ay || "").trim();
  const term = String(data.term || "").trim();
  const fundSource = String(data.fundSource || "").trim();
  const requestor = String(data.requestor || "").trim();
  const purpose = String(data.purpose || "").trim();
  const amount = parseMoney(data.amount);
  const issued = validateDate(data.dateIssued, "issue date");
  const returnDate = validateDate(data.expectedReturnDate, "expected return date");
  if (!ay || !term || !fundSource || !requestor) throw new Error("Term, fund, and requestor are required.");
  if (returnDate < issued) throw new Error("Expected return cannot precede issuance.");
  const advanceId = `CA-${randomUUID().split("-")[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    await assertAcademicPeriod(tx, organization.id, ay, term);
    const ledger = await getPeriodLedger(tx, organization.id, ay, term);
    if (ledger.activeRollover) throw new Error("This term has been carried forward. Reverse its rollover before posting new advances.");
    const source = ledger.funds.find((f) => f.name === fundSource);
    if (!source) throw new Error("The selected fund does not exist in this term's ledger.");
    if (toCents(source.balance) < toCents(amount)) {
      throw new Error(`Insufficient ${fundSource} balance. Available: ₱${source.balance.toFixed(2)}.`);
    }
    await tx.cashAdvance.create({
      data: {
        organizationId: organization.id,
        advanceId, academicYear: ay, term, requestor,
        purpose: purpose || null, fundSource, amountApproved: amount,
        dateIssued: issued, expectedReturnDate: returnDate,
        status: "Pending Liquidation", encodedBy: officerName,
      },
    });
    await tx.systemLog.create({
      data: {
        organizationId: organization.id, user: officerName, action: "ISSUE_ADVANCE",
        details: `Issued ₱${amount.toFixed(2)} advance ${advanceId} to ${requestor} from ${fundSource}.`,
      },
    });
    const people = await tx.tenantUser.findMany({ where: { organizationId: organization.id,
      fullName: { equals: requestor, mode: "insensitive" } }, select: { email: true }, take: 2 });
    await enqueueAccountingNotice(tx, { organizationId: organization.id, eventKey: `advance:${advanceId}`,
      documentType: "Cash Advance Issuance Notice", referenceNo: advanceId,
      academicYear: ay, term, amount, officerName, officerEmail: String(officer.email || ""),
      participantName: requestor, participantEmail: people.length === 1 ? people[0].email : null,
      participantRole: "Advance Requestor",
      details: [{label:"Source fund",value:fundSource}, {label:"Purpose",value:purpose || "Not specified"}],
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  for (const route of ["advances", "realign", "liquidations", "summary", "reports"]) {
    revalidatePath(`/department/${cleanDepartment}/${route}`);
  }
  revalidatePath(`/department/${cleanDepartment}`);
  scheduleDigitalReceiptDispatch(organization.id, `advance:${advanceId}`);
  return { success: true, advanceId };
}
