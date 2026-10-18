/**
 * READ-ONLY BY DEFAULT: recover a historical collectible balance that an old
 * Void Center failed to restore when its receipt was marked VOID.
 *
 * node scripts/reconcile-voided-collectible.cjs janitorial "A.Y. 2026 - 2027" "1st Sem" 26-004
 * node scripts/reconcile-voided-collectible.cjs janitorial "A.Y. 2026 - 2027" "1st Sem" 26-004 --apply --confirm=RESTORE-VOIDED-DUE --reason="Approved accounting correction #123"
 *
 * Does not unvoid any receipts or edit historical OR entries. Verifies the
 * exact target student + category + item + standalone fee and expected due.
 */
'use strict';
try { require('@next/env').loadEnvConfig(process.cwd()); } catch (_) { /* DATABASE_URL may already be set */ }
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const v = x => String(x ?? '').trim();
const norm = x => v(x).toLowerCase();
const cents = n => Math.round(Number(n) * 100);
const voided = s => /VOID|CANCEL/i.test(v(s));
function dueIdentity(status) {
  const m = v(status).match(/\|SID:([^|]+)\|ITEM:([^|]+)/);
  if (!m) return null;
  try { return { studentId: decodeURIComponent(m[1]), item: decodeURIComponent(m[2]) }; }
  catch { return null; }
}
const [department, ay, term, orNumber] = process.argv.slice(2, 6).map(v);
const applying = process.argv.includes('--apply');
const approved = process.argv.includes('--confirm=RESTORE-VOIDED-DUE');
const reason = v((process.argv.find(s => s.startsWith('--reason=')) || '').slice(9));
async function main() {
  if (!/^[a-z0-9-]+$/.test(department) || !ay || !term || !orNumber || orNumber.length > 60) {
    throw Error('Usage: node scripts/reconcile-voided-collectible.cjs <department> "<A.Y.>" "<term>" <OR> [--apply --confirm=RESTORE-VOIDED-DUE --reason="..."]');
  }
  if (applying && (!approved || reason.length < 10 || reason.length > 500)) {
    throw Error('To modify records, pass --apply, --confirm=RESTORE-VOIDED-DUE, and an audit reason of 10–500 characters.');
  }
  const org = await prisma.organization.findUnique({ where: { subdomain: department }, select: { id: true, name: true } });
  if (!org) throw Error('Tenant not found.');
  const result = await prisma.$transaction(async tx => {
    const where = { organizationId: org.id, academicYear: ay, term };
    // Old receipt-void logic writes the base OR into VoidTransaction.
    const voidEntry = await tx.voidTransaction.findFirst({ where: {
      organizationId: org.id, referenceId: orNumber, transactionType: 'COLLECTIONS',
    }, select: { id: true, reason: true } });
    if (!voidEntry) throw Error('No authorized receipt void record exists for this OR; do not restore it automatically.');
    const related = await tx.collection.findMany({ where: {
      ...where, OR: [
        { orNumber }, { orNumber: { startsWith: `${orNumber}-P` } },
      ],
    } });
    const escapedOR = orNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const precise = new RegExp(`^${escapedOR}(?:-P\\d{2,})?$`, 'i');
    const receipts = related.filter(row => precise.test(row.orNumber));
    if (receipts.length !== 1) throw Error('Only single-line collectible receipts can be auto-reconciled; this OR has ' + receipts.length + ' rows.');
    const receipt = receipts[0];
    if (!voided(receipt.status) || !voided(receipt.paymentType)) {
      throw Error('Receipt is not fully voided; correction is not justified.');
    }
    if (/^Penalty Fine\s*(?:\[|:)/i.test(receipt.itemDescription)) {
      throw Error('Penalty receipts have a separate reversal process.');
    }
    if (!receipt.studentId) throw Error('Receipt has no linked student ID.');
    const student = await tx.student.findFirst({ where: {
      organizationId: org.id, id: receipt.studentId,
    }, select: { id: true, studentId: true } });
    if (!student) throw Error('Linked student not found.');
    const assessments = (await tx.collectible.findMany({ where: {
      ...where, category: { equals: receipt.category, mode: 'insensitive' },
    } })).filter(due => {
      const marker = dueIdentity(due.status);
      return marker && norm(marker.studentId) === norm(student.studentId) &&
        norm(marker.item) === norm(receipt.itemDescription);
    });
    if (assessments.length !== 1) {
      throw Error(`Expected exactly one linked student assessment; found ${assessments.length}. No change made.`);
    }
    const due = assessments[0];
    if (voided(due.status)) throw Error('Assessment itself is voided. Manual review required.');
    const configs = await tx.collectionSetup.findMany({ where: {
      ...where, isPackage: false,
      category: { equals: receipt.category, mode: 'insensitive' },
      name: { equals: receipt.itemDescription, mode: 'insensitive' },
    }, select: { amount: true, targetFund: true } });
    if (configs.length !== 1) throw Error('No unique standalone Fee Setup match. Manual review required.');
    const previousRestoration = await tx.systemLog.findFirst({ where: {
      organizationId: org.id, action: 'RESTORE_COLLECTIBLE_PAYMENT',
      details: { contains: `OR ${orNumber};` },
    }, select: { id: true } });
    const olderRestoration = await tx.systemLog.findFirst({ where: {
      organizationId: org.id, action: 'RECONCILE_VOIDED_COLLECTIBLE',
      details: { contains: `OR ${orNumber};` },
    }, select: { id: true } });
    if (previousRestoration || olderRestoration) throw Error('This OR already has a collectible restoration audit log; duplicate repair blocked.');
    const [paymentCents, oldCents, feeCents] = [receipt.amountPaid, due.balanceDue, configs[0].amount].map(cents);
    const activeSameFee = await tx.collection.findMany({ where: {
      ...where, studentId: student.id,
      category: { equals: receipt.category, mode: 'insensitive' },
      itemDescription: { equals: receipt.itemDescription, mode: 'insensitive' },
    }, select: { amountPaid: true, status: true, paymentType: true } });
    const activePaidCents = activeSameFee.filter(c => !voided(c.status) && !voided(c.paymentType))
      .reduce((sum, c) => sum + cents(c.amountPaid), 0);
    const expectedCents = feeCents - activePaidCents;
    const restoredCents = oldCents + paymentCents;
    if (![paymentCents, oldCents, feeCents, activePaidCents, expectedCents, restoredCents].every(Number.isSafeInteger) ||
      paymentCents <= 0 || feeCents <= 0 || oldCents < 0 || expectedCents < 0 ||
      restoredCents !== expectedCents) {
      throw Error(`Unsafe repair: due ${oldCents / 100}, voided OR ${paymentCents / 100}, resulting ${restoredCents / 100}, but expected ${expectedCents / 100} from Fee Setup and active receipts. Manual investigation required.`);
    }
    const details = {
      department, ay, term, orNumber,
      studentId: student.studentId, category: receipt.category, item: receipt.itemDescription,
      originalReceiptFund: receipt.fundAllocation, currentDue: oldCents / 100,
      voidedPayment: paymentCents / 100, restoredDue: restoredCents / 100,
      feeAmount: feeCents / 100, activeReceipts: activePaidCents / 100,
    };
    if (applying) {
      const updated = await tx.collectible.updateMany({ where: {
        id: due.id, organizationId: org.id, status: due.status,
        balanceDue: due.balanceDue,
      }, data: {
        balanceDue: restoredCents / 100,
        status: v(due.status).replace(/^Paid/i, 'Unpaid'),
      } });
      if (updated.count !== 1) throw Error('Concurrent change to collectible. No correction applied.');
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: 'Authorized Database Reconciliation',
        action: 'RECONCILE_VOIDED_COLLECTIBLE',
        details: `OR ${orNumber}; assessment ${due.id}; student ${student.studentId}; ` +
          `${receipt.category} / ${receipt.itemDescription}; restored ₱${(paymentCents / 100).toFixed(2)}; ` +
          `balance ₱${(oldCents / 100).toFixed(2)} → ₱${(restoredCents / 100).toFixed(2)}; ` +
          `${ay} ${term}; previous receipt void entry ${voidEntry.id}; reason: ${reason}.`,
      } });
    }
    return details;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
  console.log(`CLEAR collectible reconciliation — ${applying ? 'APPLIED' : 'DRY RUN (NO WRITES)'}`);
  console.log(JSON.stringify(result, null, 2));
  if (!applying) console.log('No changes made. Verify above figures, back up your DB, and rerun with --apply, --confirm=RESTORE-VOIDED-DUE, and --reason="...".');
}
main().catch(e => { console.error('Reconciliation aborted:', e.message); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
