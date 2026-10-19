"use server";
import { parseClearAccountingDate } from '@/lib/clear-timezone';

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getPeriodLedger, toCents, fromCents } from "../realign/ledger";
import { randomUUID } from "node:crypto";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";
import { enqueueAccountingNotice, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";

interface ExpenseInput {
  qty: number;
  orsi: string;
  desc: string;
  subTotal: number;
  proofBase64?: string;
  proofMime?: string;
}
interface AuditInput {
  date: string;
  advanceId: string;
  requestor: string;
  fundSource: string;
  budgetRequested: number;
  totalExpense: number;
  items: ExpenseInput[];
  ay: string;
  term: string;
}

const clean = (value: unknown): string => String(value ?? "").trim();
const inactive = (status: unknown): boolean => /VOID|CANCEL|REJECT/i.test(clean(status));
const isOpenAdvance = (status: unknown): boolean => {
  const s = clean(status).toUpperCase();
  return !inactive(s) && !s.includes("LIQUIDATED") &&
    (s.includes("PENDING") || s.includes("UNLIQUIDATED") || s === "ACTIVE");
};

function dateOnly(value: unknown): Date {
  try { return parseClearAccountingDate(clean(value)); }
  catch { throw new Error("Invalid audit date. Use YYYY-MM-DD."); }
}

const PROOF_FORMAT = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/;
function checkProof(proof: unknown, declaredMime: unknown): string | null {
  if (!proof) return null;
  if (typeof proof !== "string") throw new Error("Invalid receipt attachment.");
  const match = PROOF_FORMAT.exec(proof);
  if (!match || (clean(declaredMime) && clean(declaredMime) !== match[1])) {
    throw new Error("Receipt attachment must be a PNG, JPEG, WebP image, or PDF.");
  }
  const byteSize = Buffer.byteLength(match[2], "base64");
  if (byteSize < 1 || byteSize > 850 * 1024) {
    throw new Error("Each receipt attachment must be 850 KB or less.");
  }
  return proof;
}

export async function recordAudit(department: string, data: AuditInput) {
  const dept = clean(decodeURIComponent(department)).toLowerCase();
  const actor = await requireTabAccess("tab-audit", dept);
  const officer = clean((actor as any).fullName || (actor as any).name || (actor as any).email) || "Authorized Officer";
  const org = await prisma.organization.findUnique({
    where: { subdomain: dept },
    select: { id: true },
  });
  if (!org) throw new Error("Department organization not found.");
  const ay = clean(data.ay);
  const term = clean(data.term);
  const advanceId = clean(data.advanceId);
  const date = dateOnly(data.date);
  if (!ay || !term) {
    throw new Error("Valid academic year and term are required.");
  }
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 40) {
    throw new Error("Provide between 1 and 40 expense items.");
  }
  const items = data.items.map((item, index) => {
    const qty = Number(item.qty);
    const desc = clean(item.desc);
    const subtotal = toCents(item.subTotal);
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100000) {
      throw new Error(`Item ${index + 1}: quantity must be a positive whole number.`);
    }
    if (!desc || desc.length > 1000 || subtotal <= 0) {
      throw new Error(`Item ${index + 1}: a description and positive subtotal are required.`);
    }
    return {
      qty,
      orSiNumber: clean(item.orsi).slice(0, 150) || null,
      description: desc,
      subTotal: fromCents(subtotal),
      receiptProofUrl: checkProof(item.proofBase64, item.proofMime),
    };
  });
  // Keep Server Action requests within the default ~1MB Next.js request body limit.
  const proofBytes = items.reduce((sum, item) => sum + (item.receiptProofUrl?.length || 0), 0);
  if (proofBytes > 900000) {
    throw new Error("Combined receipt attachments are too large. Upload smaller images/PDFs.");
  }
  const actualExpenseCents = items.reduce((sum, item) => sum + toCents(item.subTotal), 0);
  if (toCents(data.totalExpense) !== actualExpenseCents) {
    throw new Error("Item subtotals do not match the submitted expense total.");
  }
  if (actualExpenseCents <= 0) throw new Error("The liquidation must have a positive expense total.");

  let auditId = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      auditId = `AUD-${randomUUID().slice(0, 8).toUpperCase()}`;
      await prisma.$transaction(async tx => {
        await assertAcademicPeriod(tx, org.id, ay, term);
        const ledger = await getPeriodLedger(tx, org.id, ay, term);
        if (ledger.activeRollover) {
          throw new Error("This term has been carried over. Reverse the rollover before posting a liquidation.");
        }
        let requestor = clean(data.requestor);
        let fundSource = clean(data.fundSource);
        let budgetCents = 0;
        let advance: Awaited<ReturnType<typeof tx.cashAdvance.findFirst>> = null;
        if (advanceId) {
          advance = await tx.cashAdvance.findFirst({
            where: { organizationId: org.id, advanceId, academicYear: ay, term },
          });
          if (!advance) throw new Error("Cash advance not found in this academic term.");
          if (!isOpenAdvance(advance.status)) throw new Error("This advance is not pending liquidation.");
          const previous = await tx.audit.findFirst({
            where: { organizationId: org.id, referenceCaId: advanceId,
              NOT: { OR: [
                { status: { contains: "VOID", mode: "insensitive" } },
                { status: { contains: "CANCEL", mode: "insensitive" } },
              ] },
            },
            select: { id: true },
          });
          if (previous) throw new Error("An audit already exists for this cash advance.");
          // These values must come from the authenticated database, never from form inputs.
          requestor = advance.requestor;
          fundSource = advance.fundSource;
          budgetCents = toCents(advance.amountApproved);
        } else if (!requestor || requestor.length > 250) {
          throw new Error("Enter a valid direct-expense requestor.");
        }
        if (!fundSource) throw new Error("Choose an existing fund pool.");
        const fundBalance = ledger.funds.find(f => f.name === fundSource);
        if (!fundBalance) throw new Error(`Fund pool '${fundSource}' was not found in this term.`);
        // A pending advance already reserves its approved amount in the shared ledger.
        // Posting the audit releases that hold and books the actual expense instead.
        const additionalRequired = Math.max(0, actualExpenseCents - budgetCents);
        if (additionalRequired > toCents(fundBalance.balance)) {
          throw new Error(`Insufficient available balance in ${fundSource} for the excess/direct expense.`);
        }
        const varianceCents = budgetCents - actualExpenseCents;
        const audit = await tx.audit.create({
          data: {
            organizationId: org.id,
            auditId,
            academicYear: ay,
            term,
            date,
            referenceCaId: advanceId || "Direct Expense (No CA)",
            requestor,
            fundSource,
            budgetRequested: fromCents(budgetCents),
            totalExpense: fromCents(actualExpenseCents),
            varianceReturn: advance ? fromCents(Math.max(0, varianceCents)) : 0,
            reimbursementDue: advance ? fromCents(Math.max(0, -varianceCents)) : 0,
            status: "Audited & Verified",
            encodedBy: officer,
          },
        });
        await tx.expenseItem.createMany({
          data: items.map(item => ({
            organizationId: org.id,
            auditId: audit.auditId,
            ...item,
          })),
        });
        if (advance) {
          await tx.cashAdvance.update({
            where: { id: advance.id },
            data: { status: "Liquidated" },
          });
        }
        await tx.systemLog.create({
          data: {
            organizationId: org.id,
            user: officer,
            action: "RECORD_LIQUIDATION",
            details: `Audit ${auditId}; CA ${advanceId || "DIRECT"}; ${ay} ${term}; ${fundSource}; budget ₱${fromCents(budgetCents).toFixed(2)}; spent ₱${fromCents(actualExpenseCents).toFixed(2)}; variance ₱${fromCents(varianceCents).toFixed(2)}.`,
          },
        });
        const people = await tx.tenantUser.findMany({ where: { organizationId: org.id,
          fullName: { equals: requestor, mode: "insensitive" } }, select: { email: true }, take: 2 });
        await enqueueAccountingNotice(tx, { organizationId: org.id, eventKey: `liquidation:${auditId}`,
          documentType: "Liquidation Audit Summary", referenceNo: auditId,
          academicYear: ay, term, amount: fromCents(actualExpenseCents), officerName: officer,
          officerEmail: String((actor as any).email || ""), participantName: requestor,
          participantEmail: people.length === 1 ? people[0].email : null,
          participantRole: "Liquidation Requestor",
          details: [{label:"Source fund",value:fundSource},
            {label:"Cash Advance",value:advanceId || "Direct expense"},
            {label:"Audit result",value:"Audited — not proof of a cash disbursement"}],
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
      break;
    } catch (error: any) {
      if ((error?.code === "P2034" || error?.code === "P2002") && attempt < 2) continue;
      throw error;
    }
  }
  const root = `/department/${dept}`;
  for (const route of ["", "/liquidations", "/advances", "/summary", "/reports", "/realign", "/clearance", "/setup"]) {
    revalidatePath(root + route);
  }
  scheduleDigitalReceiptDispatch(org.id, `liquidation:${auditId}`);
  return { success: true, auditId };
}
