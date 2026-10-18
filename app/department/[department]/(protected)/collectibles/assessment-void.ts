/** Shared server-only, accounting-safe collectible assessment reversal.
 * Call within an existing SERIALIZABLE Prisma transaction; caller separately
 * records VoidTransaction + SystemLog and checks permission/period closure.
 */
import type { Prisma } from "@prisma/client";
import { decodeStudentDue } from "./due-link";

type Tx = Prisma.TransactionClient;
const isVoid = (x: unknown) => /VOID|CANCEL/i.test(String(x || ""));
const isActiveReceipt = (r: { status: string; paymentType: string }) =>
  !isVoid(r.status) && !isVoid(r.paymentType);
const normalize = (x: unknown) => String(x || "").trim().toLowerCase();
const cents = (x: unknown) => Math.round(Number(x) * 100);

export async function voidStudentCollectibleAssessment(
  tx: Tx,
  args: { organizationId: string; collectibleId: string; reason: string },
): Promise<{ id: string; ay: string; term: string; amount: number; details: string }> {
  const { organizationId, collectibleId, reason } = args;
  const due = await tx.collectible.findFirst({
    where: { id: collectibleId, organizationId },
  });
  if (!due) throw new Error("Assessment not found for this organization.");
  if (isVoid(due.status)) throw new Error("Assessment has already been voided.");
  if (/^(PAID|SETTLED)/i.test(String(due.status || ""))) {
    throw new Error("This assessment is marked paid. Reconcile/reverse payment receipts before voiding it.");
  }

  const marker = decodeStudentDue(due.status);
  const period = { organizationId, academicYear: due.academicYear, term: due.term };
  const outstanding = cents(due.balanceDue);
  if (!Number.isSafeInteger(outstanding) || outstanding < 0) {
    throw new Error("The assessment balance is invalid; accounting reconciliation is required.");
  }

  let receiptCount = 0;
  let originalAmount: number;
  if (marker) {
    const student = await tx.student.findFirst({
      where: { organizationId, studentId: { equals: marker.studentId, mode: "insensitive" } },
      select: { id: true, studentId: true },
    });
    if (!student) throw new Error("The assessed student cannot be verified. No changes were made.");
    const pendingSubmissions = await tx.onlineRemittance.findMany({ where: {
      ...period,
      studentId: { equals: student.studentId, mode: "insensitive" },
      category: { equals: due.category, mode: "insensitive" },
      itemDescription: { equals: marker.itemDescription, mode: "insensitive" },
      status: { in: ["Pending", "Pending Verification", "PENDING", "PENDING VERIFICATION"] },
    }, select: { id: true } });
    if (pendingSubmissions.length) {
      throw new Error("A matching online remittance is still pending review. Reject or resolve the remittance before voiding this assessment.");
    }
    const feeRows = await tx.collectionSetup.findMany({
      where: { ...period, isPackage: false,
        category: { equals: due.category, mode: "insensitive" },
        name: { equals: marker.itemDescription, mode: "insensitive" } },
      select: { amount: true },
    });
    if (feeRows.length !== 1) {
      throw new Error("Cannot verify the original assessment amount from Fee Setup. Reconcile the fee before voiding.");
    }
    originalAmount = cents(feeRows[0].amount);
    // A payment might have been recorded without a permanent collectible ID link.
    // Reject while there is ANY possible active matching OR; never guess which
    // payment should be undone. Voids must go through the OR reversal action first.
    const receipts = await tx.collection.findMany({ where: {
      ...period, studentId: student.id,
      category: { equals: due.category, mode: "insensitive" },
      itemDescription: { equals: marker.itemDescription, mode: "insensitive" },
    }, select: { id: true, status: true, paymentType: true } });
    receiptCount = receipts.length;
    if (receipts.some(isActiveReceipt)) {
      throw new Error("This assessment has an active payment receipt. Void its OR in Void Center first; only then can you void the assessment.");
    }
    // Historical arrears are receipted in the CURRENT period, but link back to
    // this assessment. Check the linked receipts regardless of origin period.
    const links = await tx.arrearPaymentLink.findMany({ where: {
      organizationId, obligationType: "collectible", obligationId: due.id,
    }, select: { receiptId: true } });
    if (links.length) {
      const linkedReceipts = await tx.collection.findMany({ where: {
        organizationId, id: { in: links.map(l => l.receiptId) },
      }, select: { id: true, status: true, paymentType: true } });
      if (linkedReceipts.length !== links.length || linkedReceipts.some(isActiveReceipt)) {
        throw new Error("This assessment has active or unverified historical payments. Reverse/reconcile linked ORs first.");
      }
      receiptCount += linkedReceipts.length;
    }
    // The older schema has no immutable assessment base amount; only a fully
    // restored balance may be voided. This catches unlinked/legacy payments.
    if (outstanding !== originalAmount) {
      throw new Error(`Assessment is not fully restored (original ₱${(originalAmount / 100).toFixed(2)}, outstanding ₱${(outstanding / 100).toFixed(2)}). Reverse/reconcile all payments before voiding.`);
    }
    const matchingDues = await tx.collectible.findMany({ where: {
      ...period, category: { equals: due.category, mode: "insensitive" },
    }, select: { id: true, status: true } });
    if (matchingDues.some(other => other.id !== due.id &&
      decodeStudentDue(other.status)?.studentId.toLowerCase() === normalize(marker.studentId) &&
      normalize(decodeStudentDue(other.status)?.itemDescription) === normalize(marker.itemDescription) &&
      !isVoid(other.status))) {
      throw new Error("Duplicate student assessments for the same fee exist. Resolve duplicates before voiding.");
    }
  } else {
    // Legacy bulk category assessments are not student-linked. They cannot be
    // linked to particular receipts, so conservatively block when income from
    // this category exists in this period.
    const categoryReceipts = await tx.collection.findMany({ where: {
      ...period, category: { equals: due.category, mode: "insensitive" },
    }, select: { status: true, paymentType: true } });
    if (categoryReceipts.some(isActiveReceipt)) {
      throw new Error("This summary assessment shares a category with active receipts. Reconcile payment activity before voiding.");
    }
    originalAmount = outstanding;
    receiptCount = categoryReceipts.length;
  }

  if (originalAmount <= 0 || outstanding <= 0) {
    throw new Error("Zero-balance or paid assessment cannot be voided directly. Review its payment history first.");
  }
  const status = marker
    ? `Voided|SID:${encodeURIComponent(marker.studentId)}|ITEM:${encodeURIComponent(marker.itemDescription)}`
    : "Voided";
  const updated = await tx.collectible.updateMany({
    where: { id: due.id, organizationId, status: due.status, balanceDue: due.balanceDue },
    data: { status, balanceDue: 0 },
  });
  if (updated.count !== 1) throw new Error("Assessment changed concurrently. Reload and retry.");
  return {
    id: due.id, ay: due.academicYear, term: due.term,
    amount: outstanding / 100,
    details: `Collectible ${due.id}; category ${due.category}; ${marker ?
      `student ${marker.studentId}; item ${marker.itemDescription}` : `summary headcount ${due.headcount}`}; ` +
      `original status ${due.status}; reversed outstanding ₱${(outstanding / 100).toFixed(2)}; ` +
      `original assessment ₱${(originalAmount / 100).toFixed(2)}; ` +
      `associated previously reversed OR rows ${receiptCount}; ${due.academicYear} / ${due.term}; reason: ${reason}`,
  };
}
