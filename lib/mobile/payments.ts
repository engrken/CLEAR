// /lib/mobile/payments.ts
//
// Officer "Collect" screen for the mobile API: recording an official-receipt
// payment, the fee list it picks from, and the suggested next OR number.
//
// Ken's web code is the source of truth. The payment write MIRRORS
//   app/department/[department]/(protected)/collections/actions.ts → recordPayment
// (an unexported 'use server' body tied to next-auth, requireTabAccess and
// revalidatePath). Keep the two in sync: same guards, same rows written, same
// error rules. Shared logic is imported from Ken's modules, not copied:
//   lib/academic-period-guard.ts                      assertAcademicPeriod
//   (protected)/realign/ledger.ts                     getPeriodLedger, toCents
//   (protected)/collectibles/due-link.ts              applyPaymentToStudentCollectibles
//   lib/digital-receipts.ts                           enqueuePaymentReceipt, scheduleDigitalReceiptDispatch
//   lib/penalty-fund.ts / lib/penalty-fund.server.ts  PENALTY_FUND_NAME, ensurePenaltyFund
//
// The only intended differences: errors are ApiFailure codes instead of plain
// Error (same message text), the period is the org's active AY/term, the date
// is today's Manila calendar date, and the fee comes from a CollectionSetup id.

import type { Organization } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiFailure } from '@/lib/mobile/http';
import { toCentavos } from '@/lib/mobile/serialize';
import { manilaDateInput, parseClearAccountingDate } from '@/lib/clear-timezone';
import { assertAcademicPeriod } from '@/lib/academic-period-guard';
import { enqueuePaymentReceipt, scheduleDigitalReceiptDispatch } from '@/lib/digital-receipts';
import { PENALTY_FUND_NAME } from '@/lib/penalty-fund';
import { ensurePenaltyFund } from '@/lib/penalty-fund.server';
import { getPeriodLedger, toCents } from '@/app/department/[department]/(protected)/realign/ledger';
import { applyPaymentToStudentCollectibles } from '@/app/department/[department]/(protected)/collectibles/due-link';

/** collections/actions.ts PACKAGE_NAME and CollectionsForm.tsx DEPARTMENTAL_PACKAGE_NAME. */
export const PACKAGE_NAME = 'Departmental Fee Package (All Items)';
/** The fund label CollectionsForm.tsx shows for a package (rejected by the generic branch). */
export const PACKAGE_FUND_LABEL = 'Multiple Funds (Package Split)';
/** Fee ids for the package pseudo-item: `package:<id of any package CollectionSetup in the category>`. */
export const PACKAGE_FEE_PREFIX = 'package:';

const OR_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,50}$/;

// ---------------------------------------------------------------- Fee list

export type MobileFeeItem = {
  id: string;
  category: string;
  name: string;
  amountCentavos: number;
  targetFund: string;
  /** Added after 1.0.0. 'package' = the per-category package pseudo-item. */
  kind: 'package' | 'item';
  /** Added after 1.0.0. The CollectionSetup.isPackage flag (true for the pseudo-item). */
  isPackage: boolean;
  /** Added after 1.0.0. Only on the package pseudo-item: the mandatory items it splits across. */
  packageItems?: { id: string; name: string; amountCentavos: number; targetFund: string }[];
};

/**
 * Fee items for the org's active term, as Ken's Collections form offers them
 * (collections/CollectionsForm.tsx): within a category, two or more
 * `isPackage === true` items become one "Departmental Fee Package (All Items)"
 * entry priced at their sum; a lone package item and every standalone
 * (`isPackage === false`) item are listed by themselves. No institution
 * fallback: CollectionSetup is the only source of package configuration.
 */
export async function listMobileFeeItems(org: Pick<Organization, 'id' | 'activeAy' | 'activeTerm'>): Promise<MobileFeeItem[]> {
  const setups = await prisma.collectionSetup.findMany({
    where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const out: MobileFeeItem[] = [];
  const categories = [...new Set(setups.map((s) => s.category))];
  for (const category of categories) {
    const inCategory = setups.filter((s) => s.category === category);
    const pkg = inCategory.filter((s) => s.isPackage === true);
    const grouped = pkg.length > 1;
    if (grouped) {
      const items = pkg.map((s) => ({
        id: s.id, name: s.name, amountCentavos: toCentavos(s.amount), targetFund: s.targetFund,
      }));
      out.push({
        id: `${PACKAGE_FEE_PREFIX}${pkg[0].id}`,
        category,
        name: PACKAGE_NAME,
        amountCentavos: items.reduce((sum, i) => sum + i.amountCentavos, 0),
        targetFund: PACKAGE_FUND_LABEL,
        kind: 'package',
        isPackage: true,
        packageItems: items,
      });
    }
    // Ken's CollectionsForm lists every item of the category after the package option.
    for (const s of inCategory) {
      out.push({
        id: s.id,
        category: s.category,
        name: s.name,
        amountCentavos: toCentavos(s.amount),
        targetFund: s.targetFund,
        kind: 'item',
        isPackage: s.isPackage === true,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- Next OR

/**
 * Suggested next OR number (YY-NNN), mirroring collections/page.tsx: the
 * highest YY-NNN (or YY-NNN-Pnn) issued in the AY plus one. Only a suggestion;
 * the officer types the number printed on the paper receipt.
 */
export async function suggestNextOr(org: Pick<Organization, 'id' | 'activeAy'>) {
  const ay = org.activeAy;
  const recentReceipts = await prisma.collection.findMany({
    where: { organizationId: org.id, academicYear: ay },
    select: { orNumber: true },
  });
  const match = ay.match(/\d{4}/);
  const yearPrefix = match ? match[0].slice(-2) : '26';
  const pattern = new RegExp(`^${yearPrefix}-(\\d+)(?:-P\\d+)?$`, 'i');
  const maxNum = recentReceipts.reduce((max, r) => {
    const m = String(r.orNumber || '').match(pattern);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return `${yearPrefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

// ---------------------------------------------------------------- Record payment

/** Today's accounting date in Asia/Manila, stored exactly as Ken's dateOnly() does (lib/clear-timezone.ts). */
export function manilaPaymentDate(now = new Date()) {
  return parseClearAccountingDate(manilaDateInput(now));
}

export type MobilePaymentInput = {
  /** Student row id or school student ID (case-insensitive). */
  studentId: string;
  /** CollectionSetup id, or `package:<id>` for the package pseudo-item. Ignored with penaltyId. */
  feeId?: string;
  /** Penalty.penaltyId: settles that penalty (Ken's Penalty Logs → Pay in Cash). */
  penaltyId?: string;
  amountCentavos: number;
  orNumber: string;
};

export type MobilePaymentLine = {
  id: string;
  orNumber: string;
  itemDescription: string;
  fundAllocation: string;
  amountCentavos: number;
  balanceDueCentavos: number;
  paymentType: string;
};

export type MobilePaymentResult = {
  orNumber: string;
  studentName: string;
  itemDescription: string;
  paymentType: string;
  balanceDueCentavos: number;
  amountCentavos: number;
  lines: MobilePaymentLine[];
  firstReceipt: { id: string; studentName: string; orNumber: string; itemDescription: string;
    amountPaid: number; status: string; paymentType: string; timestamp: Date };
};

/** Ken's plain-Error messages from the helpers we import, mapped to API codes. */
function mapKenError(err: unknown): unknown {
  if (err instanceof ApiFailure || !(err instanceof Error)) return err;
  const m = err.message;
  if (/^Accounting period .* is closed\./.test(m) || /is not enabled for this organization/.test(m)) {
    return new ApiFailure(409, 'period_closed', m);
  }
  if (/^Multiple active assessments match/.test(m) || /outstanding due changed during payment/.test(m)) {
    return new ApiFailure(409, 'conflict', m);
  }
  if (/^Payment category is required/.test(m) || /^Invalid or excessively large monetary amount/.test(m)) {
    return new ApiFailure(400, 'invalid', m);
  }
  if ((err as { code?: string }).code === 'P2002') {
    return new ApiFailure(409, 'duplicate_or', 'Official receipt is already used. Refresh and select an unused OR.');
  }
  return err;
}

/** Mirrors recordPayment's money() for the peso value of a centavo amount. */
function pesosOf(centavos: number) {
  if (!Number.isSafeInteger(centavos) || centavos <= 0) {
    throw new ApiFailure(400, 'invalid', 'Payment must be a positive amount with at most two decimal places.');
  }
  return centavos / 100;
}

/**
 * MIRROR of collections/actions.ts recordPayment (lines ~38-275 at Ken's 6692aed).
 * Serializable transaction with P2034 retry; period guard; roster check; OR
 * format and org-wide uniqueness (including -Pnn lines); cents arithmetic;
 * package / generic / penalty branches; Collection rows; collectible dues;
 * SystemLog; digital receipt outbox; dispatch after commit.
 */
export async function recordMobilePayment(
  org: Pick<Organization, 'id' | 'activeAy' | 'activeTerm'>,
  officer: { fullName?: string | null; email?: string | null },
  input: MobilePaymentInput,
): Promise<MobilePaymentResult> {
  const officerName = String(officer.fullName || officer.email || 'System Administrator');
  const ay = String(org.activeAy || '').trim();
  const term = String(org.activeTerm || '').trim();
  const orNumber = String(input.orNumber || '').trim().toUpperCase();
  const paid = pesosOf(input.amountCentavos);
  const date = manilaPaymentDate();
  const studentKey = String(input.studentId || '').trim();
  const penaltyId = String(input.penaltyId || '').trim();
  const feeId = String(input.feeId || '').trim();

  if (!ay || !term || !orNumber || !studentKey || (!penaltyId && !feeId)) {
    throw new ApiFailure(400, 'invalid', 'Student, receipt number, category, item, academic year and term are required.');
  }
  if (!OR_PATTERN.test(orNumber)) throw new ApiFailure(400, 'invalid', 'Invalid official receipt number.');

  // The web form sends category + itemDescription; the app sends a fee id.
  // Resolve it to the same pair for the active term. A penalty receipt uses the
  // category and description Ken's Penalty Logs link prefills.
  let category = 'Others';
  let itemDescription = '';
  if (!penaltyId) {
    const isPackageId = feeId.startsWith(PACKAGE_FEE_PREFIX);
    const setup = await prisma.collectionSetup.findFirst({
      where: {
        id: isPackageId ? feeId.slice(PACKAGE_FEE_PREFIX.length) : feeId,
        organizationId: org.id, academicYear: ay, term,
        ...(isPackageId ? { isPackage: true } : {}),
      },
    });
    if (!setup) throw new ApiFailure(400, 'invalid', 'Choose a fee item for the current term.');
    category = String(setup.category || '').trim();
    itemDescription = isPackageId ? PACKAGE_NAME : String(setup.name || '').trim();
    if (!category || !itemDescription) {
      throw new ApiFailure(400, 'invalid', 'Student, receipt number, category, item, academic year and term are required.');
    }
  }

  let actualPaymentType = 'Partial Payment';
  let balanceDue = 0;
  let studentName = '';
  let postedDescription = itemDescription;
  let created: MobilePaymentResult['firstReceipt'][] = [];
  let lineMeta: { fund: string; balanceCents: number }[] = [];

  const postOnce = async () => prisma.$transaction(async (tx) => {
    created = [];
    lineMeta = [];
    await assertAcademicPeriod(tx, org.id, ay, term);
    const ledger = await getPeriodLedger(tx, org.id, ay, term);
    if (ledger.activeRollover) {
      throw new ApiFailure(409, 'period_closed', 'This academic term is closed by a carry-over. Reverse the rollover before recording payments.');
    }

    const student = await tx.student.findFirst({
      where: { organizationId: org.id, OR: [
        { studentId: { equals: studentKey, mode: 'insensitive' } },
        { id: studentKey },
      ] },
    });
    if (!student) throw new ApiFailure(422, 'invalid_student', 'Student is not registered in this department.');
    studentName = student.fullName;

    const conflict = await tx.collection.findFirst({ where: { organizationId: org.id,
      OR: [{ orNumber }, { orNumber: { startsWith: `${orNumber}-P` } }] }, select: { id: true } });
    if (conflict) throw new ApiFailure(409, 'duplicate_or', `Official receipt ${orNumber} is already used. Refresh and select an unused OR.`);

    const existing = await tx.collection.findMany({ where: {
      organizationId: org.id, academicYear: ay, term, studentId: student.id,
    }, select: { itemDescription: true, amountPaid: true, status: true, paymentType: true } });
    const valid = existing.filter((row) => !String(row.status || '').toUpperCase().includes('VOID') &&
      !String(row.status || '').toUpperCase().includes('CANCEL') &&
      !String(row.paymentType || '').toUpperCase().includes('VOID'));
    const prevFor = (description: string) => valid.filter((c) =>
      String(c.itemDescription).trim().toLowerCase() === description.toLowerCase()
    ).reduce((total, c) => total + toCents(c.amountPaid), 0);

    const packageItems = await tx.collectionSetup.findMany({ where: {
      organizationId: org.id, academicYear: ay, term, category, isPackage: true,
    }, orderBy: { name: 'asc' } });

    type PaymentEntry = { name: string; fund: string; rateCents: number; paidCents: number; balanceCents: number };
    const entries: PaymentEntry[] = [];
    const paidCents = toCents(paid);

    if (penaltyId) {
      const pen = await tx.penalty.findFirst({ where: {
        organizationId: org.id, penaltyId, academicYear: ay, term,
      } });
      if (!pen) throw new ApiFailure(404, 'not_found', 'The penalty does not belong to this department or academic term.');
      const status = String(pen.status || '').trim();
      if (/VOID|CANCEL/i.test(status)) throw new ApiFailure(409, 'conflict', 'This penalty has been voided and cannot receive a payment.');
      if (/^SETTLED/i.test(status)) {
        throw new ApiFailure(409, 'conflict', 'This penalty is marked settled. If no cash receipt exists, an administrator must reconcile the legacy settlement in Penalty Logs before accepting payment.');
      }
      const due = toCents(pen.fineAmount);
      if (due <= 0) throw new ApiFailure(409, 'conflict', 'This penalty has no outstanding amount. Administrator reconciliation is required if this is incorrect.');
      if (paidCents > due) {
        throw new ApiFailure(409, 'overpayment', `Payment exceeds the outstanding fine of ₱${(due / 100).toFixed(2)}.`);
      }
      if (!pen.studentId || pen.studentId.trim().toLowerCase() !== student.studentId.trim().toLowerCase()) {
        throw new ApiFailure(422, 'invalid_student', 'The selected student does not own this penalty. No receipt was posted.');
      }
      if (pen.penaltyType !== 'LATE_FEE' && toCents(pen.ratePerHour) <= 0) {
        throw new ApiFailure(409, 'conflict', "This service-eligible penalty's hourly rate is invalid.");
      }
      const remaining = due - paidCents;
      await ensurePenaltyFund(tx, org.id, ay, term);
      const penaltyDescription = `Penalty Fine [${pen.penaltyId}]: ${pen.activity}`;
      entries.push({ name: penaltyDescription, fund: PENALTY_FUND_NAME, rateCents: due,
        paidCents, balanceCents: remaining });
      balanceDue = remaining / 100;
    } else if (itemDescription === PACKAGE_NAME) {
      if (packageItems.length === 0) throw new ApiFailure(400, 'invalid', 'No mandatory package items are configured for this category.');
      // Legacy single-row package receipts count toward the overall assessment.
      let legacyCredits = prevFor(PACKAGE_NAME);
      const itemState = packageItems.map((setup) => {
        const rateCents = toCents(setup.amount);
        const existingPaid = prevFor(String(setup.name));
        const available = Math.max(0, rateCents - existingPaid);
        const appliedLegacy = Math.min(legacyCredits, available);
        legacyCredits -= appliedLegacy;
        return { setup, rateCents, available: available - appliedLegacy, already: existingPaid + appliedLegacy };
      });
      const capacity = itemState.reduce((n, item) => n + item.available, 0);
      if (paidCents > capacity) throw new ApiFailure(409, 'overpayment', `Payment exceeds the remaining package balance of ₱${(capacity / 100).toFixed(2)}.`);
      let left = paidCents;
      for (const item of itemState) {
        const piece = Math.min(item.available, left);
        if (piece <= 0) continue;
        if (!String(item.setup.targetFund || '').trim()) throw new ApiFailure(400, 'invalid', `Package item ${item.setup.name} has no assigned fund.`);
        entries.push({ name: String(item.setup.name), fund: String(item.setup.targetFund),
          rateCents: item.rateCents, paidCents: piece, balanceCents: item.available - piece });
        left -= piece;
      }
      if (left !== 0 || entries.length === 0) throw new ApiFailure(409, 'conflict', 'Unable to allocate this package payment.');
      balanceDue = (capacity - paidCents) / 100;
    } else {
      // Penalty-looking receipts must go through the penalty branch.
      if (/^Penalty Fine\s*(?:\[|:)/i.test(itemDescription) || /^penalt(?:y|ies)$/i.test(category)) {
        throw new ApiFailure(400, 'invalid', 'Penalty payments must start from Penalty Logs → Pay in Cash and include the penalty reference.');
      }
      const setup = await tx.collectionSetup.findFirst({ where: {
        organizationId: org.id, academicYear: ay, term, category,
        name: itemDescription,
      } });
      // Ken falls back to the client's standardRate without a setup; the app
      // always names a setup (resolved above), so a vanished one is a stale list.
      if (!setup) throw new ApiFailure(409, 'conflict', 'This fee item changed. Refresh the fee list and try again.');
      const rateCents = toCents(setup.amount);
      const previous = prevFor(itemDescription);
      const remaining = Math.max(0, rateCents - previous);
      if (paidCents > remaining) throw new ApiFailure(409, 'overpayment', `Payment exceeds the remaining due of ₱${(remaining / 100).toFixed(2)}.`);
      const fund = String(setup.targetFund || '').trim();
      if (!fund || fund === PACKAGE_FUND_LABEL) throw new ApiFailure(400, 'invalid', 'Choose a valid destination fund.');
      entries.push({ name: itemDescription, fund, rateCents, paidCents,
        balanceCents: remaining - paidCents });
      balanceDue = (remaining - paidCents) / 100;
    }

    actualPaymentType = balanceDue === 0 ? 'Full Payment' : 'Partial Payment';
    if (penaltyId) postedDescription = entries[0]?.name || itemDescription;
    let firstReceiptId: string | null = null;
    for (const [index, entry] of entries.entries()) {
      const createdReceipt = await tx.collection.create({ data: {
        organizationId: org.id, academicYear: ay, term, date,
        studentId: student.id, studentName,
        orNumber: index === 0 ? orNumber : `${orNumber}-P${String(index + 1).padStart(2, '0')}`,
        category, itemDescription: entry.name,
        paymentType: entry.balanceCents === 0 ? 'Full Payment' : 'Partial Payment',
        standardRate: entry.rateCents / 100,
        amountPaid: entry.paidCents / 100,
        balanceDue: entry.balanceCents / 100,
        fundAllocation: entry.fund, status: 'Valid', encodedBy: officerName,
      } });
      if (index === 0) firstReceiptId = createdReceipt.id;
      created.push(createdReceipt);
      lineMeta.push({ fund: entry.fund, balanceCents: entry.balanceCents });
    }
    if (penaltyId) {
      // A receipt has been created above; only now change the penalty balance.
      const penalty = await tx.penalty.findFirst({ where: {
        organizationId: org.id, penaltyId, academicYear: ay, term,
      } });
      if (!penalty) throw new ApiFailure(409, 'conflict', 'Penalty changed while recording the payment.');
      const before = toCents(penalty.fineAmount);
      const afterCents = before - paidCents;
      if (afterCents < 0 || /^SETTLED/i.test(penalty.status || '') || /VOID|CANCEL/i.test(penalty.status || '')) {
        throw new ApiFailure(409, 'conflict', 'The penalty balance or status changed. No receipt has been saved; refresh the page.');
      }
      const newStatus = afterCents === 0 ? 'Settled (Cash Payment)' : 'Partially Paid (Cash Payment)';
      const result = await tx.penalty.updateMany({
        where: {
          id: penalty.id, organizationId: org.id, academicYear: ay, term,
          fineAmount: penalty.fineAmount, status: penalty.status,
        },
        data: { fineAmount: afterCents / 100, status: newStatus },
      });
      if (result.count !== 1) throw new ApiFailure(409, 'conflict', 'Concurrent penalty update detected; the payment was not recorded.');
      balanceDue = afterCents / 100;
      if (!firstReceiptId) throw new Error('Penalty receipt reference was not created.');
      await tx.penaltySettlementEvent.create({ data: {
        organizationId: org.id, penaltyRecordId: penalty.id,
        receiptId: firstReceiptId, method: 'CASH_PAYMENT', amount: paidCents / 100,
        accountingAY: ay, accountingTerm: term,
        balanceBefore: before / 100, balanceAfter: afterCents / 100,
        recordedBy: officerName, note: `Official Receipt ${orNumber}`,
      } });
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: officerName, action: 'RECORD_PENALTY_PAYMENT',
        details: `Penalty ${penalty.penaltyId}; OR ${orNumber}; student ${student.studentId}; collected ₱${paid.toFixed(2)}; before ₱${(before / 100).toFixed(2)}; after ₱${(afterCents / 100).toFixed(2)}; ${newStatus}; ${ay} ${term}.`,
      } });
    }
    if (!penaltyId && itemDescription !== PACKAGE_NAME) {
      await applyPaymentToStudentCollectibles(tx, {
        organizationId: org.id, academicYear: ay, term,
        studentId: student.studentId, category, itemDescription, amountCents: paidCents,
      });
    }
    await tx.systemLog.create({ data: {
      organizationId: org.id, user: officerName, action: 'RECORD_PAYMENT',
      details: `OR ${orNumber}: ₱${paid.toFixed(2)} from ${studentName} for ${penaltyId ? `penalty ${penaltyId}` : itemDescription}, across ${entries.length} fund line(s).`,
    } });
    await enqueuePaymentReceipt(tx, { organizationId: org.id, orNumber, officerName, officerEmail: String(officer.email || ''), source: 'COLLECTION' });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });

  for (let attempt = 0; attempt < 3; attempt++) {
    try { await postOnce(); break; }
    catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2034' && attempt < 2) continue;
      throw mapKenError(error);
    }
  }

  // Digital receipts are delivered from the transactional outbox after commit.
  scheduleDigitalReceiptDispatch(org.id, `payment:${orNumber}`);

  const lines: MobilePaymentLine[] = created.map((row, i) => ({
    id: row.id,
    orNumber: row.orNumber,
    itemDescription: row.itemDescription,
    fundAllocation: lineMeta[i]?.fund ?? '',
    amountCentavos: toCentavos(row.amountPaid),
    balanceDueCentavos: lineMeta[i]?.balanceCents ?? 0,
    paymentType: row.paymentType,
  }));
  return {
    orNumber,
    studentName,
    itemDescription: postedDescription,
    paymentType: actualPaymentType,
    balanceDueCentavos: Math.round(balanceDue * 100),
    amountCentavos: lines.reduce((sum, l) => sum + l.amountCentavos, 0),
    lines,
    firstReceipt: created[0],
  };
}
