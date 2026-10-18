import "server-only";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { emailPreferenceUrl, getTransactionEmailPreference, mayDeliverToRole } from "@/lib/transaction-email-preferences";

/* Durable, tenant-scoped delivery outbox. Queue entries are inserted in the SAME
   transaction as the financial record. SMTP happens ONLY after commit. */
type Tx = Prisma.TransactionClient;
const emailOK = (v: unknown) => typeof v === "string" &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v.trim()) && v.length <= 254;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c] || c));
const pesos = (v: number) => `PHP ${Number(v).toFixed(2)}`;
const active = (v: string) => !/VOID|CANCEL|REJECT/i.test(v);

export type NoticeInput = {
  organizationId: string;
  eventKey: string; // Unique within a tenant and transaction; never a client-controlled key.
  documentType: string; // Payment Receipt, Remittance Rejection Notice, etc.
  referenceNo: string;
  academicYear: string;
  term: string;
  amount: number;
  officerName: string;
  officerEmail?: string | null; // From requireTabAccess(), not form input.
  participantName?: string;
  participantEmail?: string | null; // Looked up from Student/TenantUser DB.
  participantRole?: string;
  details?: Array<{label:string;value:string}>;
};

export async function enqueueAccountingNotice(tx: Tx, n: NoticeInput) {
  if (!Number.isFinite(n.amount) || n.amount < 0 || !n.eventKey || !n.referenceNo) {
    throw new Error("Invalid digital document attributes.");
  }
  const org = await tx.organization.findUnique({ where: { id: n.organizationId },
    select: { name: true, reportSchoolName: true } });
  if (!org) throw new Error("Receipt organization does not exist.");
  const subject = `${n.documentType} ${n.referenceNo} — ${org.reportSchoolName || org.name}`;
  const common: Array<[string,string]> = [
    ["Document", n.documentType], ["Reference", n.referenceNo],
    ["Academic year", n.academicYear], ["Period", n.term],
    [n.documentType === "Remittance Rejection Notice" ? "Submitted amount (not received)" : "Transaction amount", pesos(n.amount)], ["Processed by", n.officerName],
    ["Issued at", new Date().toISOString()],
    ...((n.details || []).map(x => [x.label, x.value] as [string,string])),
  ];
  const recipients = new Map<string, string[]>();
  const add = (address: unknown, role: string) => {
    if (!emailOK(address)) return;
    const e = String(address).trim().toLowerCase();
    const roles = recipients.get(e) || [];
    if (!roles.includes(role)) roles.push(role);
    recipients.set(e, roles);
  };
  add(n.participantEmail, n.participantRole || "Student");
  add(n.officerEmail, "Processing Officer (Duplicate Copy)");
  if (recipients.size === 0) {
    // No customer/student or officer address exists; do NOT send to unverified
    // addresses supplied by a browser. Financial transaction remains valid.
    return { queued: 0 };
  }
  // Respect each recipient's opt-out at queue time. An officer opt-out never
  // suppresses the student's separate copy, and vice versa.
  const eligible: Array<{ email: string; roles: string[] }> = [];
  for (const [recipientEmail, roles] of recipients) {
    const role = roles.join(" + ");
    const settings = await getTransactionEmailPreference(tx, n.organizationId, recipientEmail);
    if (mayDeliverToRole(role, settings)) eligible.push({ email: recipientEmail, roles });
  }
  if (!eligible.length) return { queued: 0 };
  await tx.digitalReceiptDelivery.createMany({
    data: eligible.map(({ email: recipientEmail, roles }) => ({
      organizationId: n.organizationId,
      eventKey: n.eventKey,
      documentType: n.documentType,
      referenceNo: n.referenceNo,
      recipientEmail,
      recipientRole: roles.join(" + "),
      subject,
      html: `<!doctype html><html><body style="font:14px Arial,sans-serif;color:#152334;max-width:680px;margin:auto;line-height:1.5">
        <h2 style="color:#1268a5">${esc(org.reportSchoolName || org.name)}</h2>
        <h3>${esc(n.documentType)}</h3>
        <p><b>Copy for:</b> ${esc(roles.join(" and "))}</p>
        ${n.participantName ? `<p><b>Student / Requestor:</b> ${esc(n.participantName)}</p>` : ""}
        <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #cbd5e1">${common.map(([k,v]) =>
          `<tr><th align="left" style="background:#f1f5f9;border:1px solid #cbd5e1">${esc(k)}</th><td style="border:1px solid #cbd5e1">${esc(v)}</td></tr>`).join("")}</table>
        <p style="font-size:12px;color:#64748b">Automatically issued by CLEAR after the recorded transaction. Do not reply with credentials or payment details. This document does not substitute for an external bank or cashier receipt.</p>
        ${emailPreferenceUrl(n.organizationId, recipientEmail) ?
          `<p style="font-size:12px;color:#64748b">Optional emails: <a href="${esc(emailPreferenceUrl(n.organizationId, recipientEmail))}">Manage transaction email preferences</a>. Your receipt remains available in CLEAR even if you turn off emails.</p>` : ""}
        </body></html>`,
      status: "Pending", attempts: 0,
    })),
    skipDuplicates: true,
  });
  return { queued: eligible.length };
}

// The OR is the base receipt number; split package allocations are summarized
// under ONE digital receipt instead of issuing multiple contradictory amounts.
export async function enqueuePaymentReceipt(tx: Tx, args: {
  organizationId: string; orNumber: string; officerName: string; officerEmail?: string | null;
  source?: "COLLECTION" | "APPROVED_REMITTANCE" | "HISTORICAL_ARREAR";
}) {
  const orNumber = args.orNumber.trim().toUpperCase();
  const rows = await tx.collection.findMany({ where: { organizationId: args.organizationId,
    OR: [{ orNumber }, { orNumber: { startsWith: `${orNumber}-P` } }],
  }, orderBy: { orNumber: "asc" } });
  if (!rows.length || !rows.some(r => r.orNumber === orNumber)) throw new Error("Posted OR cannot be found for digital receipt.");
  if (rows.some(r => !active(r.status) || !active(r.paymentType))) {
    throw new Error("Voided receipt cannot generate a digital receipt.");
  }
  if (new Set(rows.map(r => r.studentId)).size !== 1) throw new Error("OR rows reference different students.");
  const studentId = rows[0].studentId;
  const student = studentId ? await tx.student.findFirst({
    where: { organizationId: args.organizationId, id: studentId }, select: { email: true, fullName: true },
  }) : null;
  const totalCents = rows.reduce((sum,r) => sum + Math.round(r.amountPaid*100), 0);
  return enqueueAccountingNotice(tx, {
    organizationId: args.organizationId, eventKey: `payment:${orNumber}`,
    documentType: "Official Payment Receipt", referenceNo: orNumber,
    academicYear: rows[0].academicYear, term: rows[0].term,
    amount: totalCents/100, officerName: args.officerName, officerEmail: args.officerEmail,
    participantName: student?.fullName || rows[0].studentName,
    participantEmail: student?.email, participantRole: "Student",
    details: [
      ["Payment source", args.source || "COLLECTION"],
      ["Payment date", rows[0].date.toISOString().slice(0, 10)],
      ["Payment breakdown", rows.map(r => `${r.category} / ${r.itemDescription}: ${pesos(r.amountPaid)} → ${r.fundAllocation}`).join(" | ")],
      ["Outstanding on receipt", pesos(rows.reduce((s,r) => s+r.balanceDue, 0))],
    ].map(([label,value]) => ({label, value})),
  });
}

/** Claims one delivery atomically: overlapping cron and inline calls cannot
 * send the same queued row at the same time. Delivery is at-least-once (SMTP
 * success followed by process crash can cause a duplicate email). */
export async function dispatchDigitalReceipts(options: {
  organizationId?: string; eventKey?: string; limit?: number;
} = {}) {
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit || 20)));
  const due = await prisma.digitalReceiptDelivery.findMany({
    where: {
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
      ...(options.eventKey ? { eventKey: options.eventKey } : {}),
      status: { in: ["Pending", "Sending"] }, nextAttemptAt: { lte: new Date() },
      attempts: { lt: 8 },
    }, orderBy: { createdAt: "asc" }, take: limit,
  });
  let sent = 0, failed = 0;
  for (const job of due) {
    const claimed = await prisma.digitalReceiptDelivery.updateMany({
      where: { id: job.id, status: job.status, nextAttemptAt: job.nextAttemptAt, attempts: job.attempts },
      data: { status: "Sending", attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 3*60*1000) },
    });
    if (!claimed.count) continue;
    try {
      // Re-check at dispatch time; a recipient can unsubscribe AFTER the
      // transaction was committed but BEFORE the queued email is sent.
      const pref = await getTransactionEmailPreference(prisma, job.organizationId, job.recipientEmail);
      if (!mayDeliverToRole(job.recipientRole, pref)) {
        await prisma.digitalReceiptDelivery.update({ where: { id: job.id },
          data: { status: "Suppressed", lastError: "Recipient opted out of routine transaction email" } });
        continue;
      }
      if (job.documentType === "Official Payment Receipt") {
        const receiptLines = await prisma.collection.findMany({ where: {
          organizationId: job.organizationId,
          OR: [{ orNumber: job.referenceNo }, { orNumber: { startsWith: `${job.referenceNo}-P` } }],
        }, select: { status: true, paymentType: true } });
        if (!receiptLines.length || receiptLines.some(r => !active(r.status) || !active(r.paymentType))) {
          await prisma.digitalReceiptDelivery.update({ where: { id: job.id },
            data: { status: "Cancelled", lastError: "Payment receipt voided before email delivery" } });
          continue;
        }
      }
      await sendEmail({ to: job.recipientEmail, subject: job.subject, html: job.html });
      await prisma.digitalReceiptDelivery.update({ where: { id: job.id },
        data: { status: "Sent", sentAt: new Date(), lastError: null } });
      sent++;
    } catch (error) {
      failed++;
      const attempts = job.attempts + 1;
      await prisma.digitalReceiptDelivery.update({ where: { id: job.id },
        data: { status: attempts >= 8 ? "Failed" : "Pending",
          lastError: String(error instanceof Error ? error.message : error).slice(0, 350),
          nextAttemptAt: new Date(Date.now() + Math.min(6*3600_000, 60_000*Math.pow(2, Math.min(attempts, 8)))) } });
    }
  }
  return { examined: due.length, sent, failed };
}

export function scheduleDigitalReceiptDispatch(organizationId: string, eventKey: string) {
  // Next.js 16 after() runs after the response. A protected cron retries any
  // unsent rows. It never changes a successful financial transaction.
  try { after(async () => {
    try { await dispatchDigitalReceipts({ organizationId, eventKey, limit: 5 }); }
    catch (err) { console.error("Digital receipt dispatch failed:", err); }
  }); } catch (err) { console.error("Digital receipt deferred; scheduled retry required:", err); }
}
