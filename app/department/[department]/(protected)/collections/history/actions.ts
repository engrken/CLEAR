"use server";

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { enqueueAccountingNotice, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";
import { cleanOrNumber, getReceiptLines, receiptStatus } from "./receipt-data";

export async function resendCollectionsReceipt(
  department: string,
  receiptNumber: string,
  recipients: { student: boolean; officer: boolean },
): Promise<{ queued: number; message: string }> {
  const slug = String(department || "").trim().toLowerCase();
  const officer = await requireTabAccess("tab-payment", slug);
  const baseOr = cleanOrNumber(receiptNumber);
  if (!recipients || (recipients.student !== true && recipients.officer !== true)) {
    throw new Error("Select at least one recipient for the receipt email.");
  }
  const org = await prisma.organization.findUnique({ where: { subdomain: slug }, select: { id: true } });
  if (!org) throw new Error("Department not found.");
  const rows = await getReceiptLines(org.id, baseOr);
  if (!rows.length) throw new Error("Receipt not found for this department.");
  if (rows.filter((r) => r.orNumber.toUpperCase() === baseOr).length !== 1) {
    throw new Error("Multiple receipt headers share this OR. Reconcile legacy records before resending.");
  }
  if (receiptStatus(rows) !== "Valid") {
    throw new Error("Voided or inconsistent receipts cannot be resent as valid payment receipts.");
  }
  if (new Set(rows.map((r) => r.studentId)).size !== 1) {
    throw new Error("Receipt student identity is inconsistent. Contact an administrator.");
  }
  if (new Set(rows.map((r) => `${r.academicYear}|${r.term}`)).size !== 1) {
    throw new Error("Receipt academic periods are inconsistent. Contact an administrator.");
  }
  const studentRecordId = rows[0].studentId;
  const student = studentRecordId ? await prisma.student.findFirst({
    where: { id: studentRecordId, organizationId: org.id },
    select: { email: true, fullName: true },
  }) : null;
  const studentEmail = recipients.student ? (student?.email || null) : null;
  const officerEmail = recipients.officer ? String(officer.email || "") : "";
  if (!studentEmail && !officerEmail) {
    throw new Error("There is no registered email address for the selected recipient. Update the student or officer profile first.");
  }

  // One resend per receipt per 5-minute window; never regenerate the OR itself.
  // The unique outbox constraint also handles simultaneous requests.
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const eventKey = `payment-resend:${baseOr}:${bucket}`;
  const sent = await prisma.$transaction(async (tx) => {
    const already = await tx.digitalReceiptDelivery.findFirst({
      where: { organizationId: org.id, eventKey }, select: { id: true },
    });
    if (already) throw new Error("This receipt was already queued for resend recently. Please wait five minutes before requesting another copy.");
    // Recheck immediately before enqueue, in case the OR changed during processing.
    const lines = await tx.collection.findMany({ where: {
      organizationId: org.id,
      OR: [{ orNumber: baseOr }, { orNumber: { startsWith: `${baseOr}-P` } }],
    }, select: { orNumber: true, status: true, paymentType: true } });
    const exact = lines.filter((line) => line.orNumber.toUpperCase() === baseOr ||
      new RegExp(`^${baseOr}-P\\d+$`, "i").test(line.orNumber));
    if (exact.filter(r => r.orNumber.toUpperCase() === baseOr).length !== 1 || receiptStatus(exact) !== "Valid") {
      throw new Error("The receipt status changed. Refresh Receipt History.");
    }
    const total = rows.reduce((sum, row) => sum + Math.round(row.amountPaid * 100), 0) / 100;
    const payload = await enqueueAccountingNotice(tx, {
      organizationId: org.id,
      eventKey,
      documentType: "Official Payment Receipt",
      referenceNo: baseOr,
      academicYear: rows[0].academicYear,
      term: rows[0].term,
      amount: total,
      officerName: String(rows[0].encodedBy || "CLEAR Officer"),
      officerEmail,
      participantName: student?.fullName || rows[0].studentName,
      participantEmail: studentEmail,
      participantRole: "Student",
      details: [
        { label: "Original receipt date", value: rows[0].date.toISOString().slice(0, 10) },
        { label: "Receipt copy", value: "Reissued electronic copy of the ORIGINAL posted receipt; not a new payment." },
        { label: "Payment breakdown", value: rows.map(row =>
          `${row.category} / ${row.itemDescription}: PHP ${row.amountPaid.toFixed(2)} → ${row.fundAllocation}`).join(" | ") },
        { label: "Resend requested by", value: String(officer.name || officer.email || "CLEAR Officer") },
      ],
    });
    await tx.systemLog.create({ data: {
      organizationId: org.id,
      user: String(officer.name || officer.email || "CLEAR Officer"),
      action: "RESEND_COLLECTIONS_RECEIPT",
      details: `Existing OR ${baseOr}; email copy queued for ${payload.queued} permitted recipient(s); no financial records changed.`,
    } });
    return payload.queued;
  });
  if (sent > 0) scheduleDigitalReceiptDispatch(org.id, eventKey);
  return { queued: sent, message: sent > 0
    ? `Queued ${sent} receipt email copy/copies. Delivery may take a moment.`
    : "No emails were queued because the selected recipients have opted out or have no eligible address. The receipt is still available for printing." };
}
