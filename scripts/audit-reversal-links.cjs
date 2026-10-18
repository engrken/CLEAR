#!/usr/bin/env node
/** READ-ONLY data-quality report for online remittance and cash-advance reversal links. */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const [department, ay, term] = process.argv.slice(2);
if (!department || !ay || !term) {
  console.error('Usage: node scripts/audit-reversal-links.cjs <tenant-subdomain> "<academic-year>" "<term>"');
  process.exit(2);
}
const cents = (n) => Math.round(Number(n || 0) * 100);
const inactive = (s) => /VOID|CANCEL/i.test(String(s || ''));
(async () => {
  const org = await prisma.organization.findUnique({ where: { subdomain: department }, select: { id: true, name: true } });
  if (!org) throw new Error('Tenant not found.');
  const where = { organizationId: org.id, academicYear: ay, term };
  const [remits, receipts, advances, audits] = await Promise.all([
    prisma.onlineRemittance.findMany({ where, select: {
      submissionId: true, orNumber: true, status: true, amountPaid: true, studentId: true,
    } }),
    prisma.collection.findMany({ where, select: {
      orNumber: true, status: true, paymentType: true, amountPaid: true,
    } }),
    prisma.cashAdvance.findMany({ where, select: {
      advanceId: true, status: true, fundSource: true, amountApproved: true,
    } }),
    prisma.audit.findMany({ where, select: {
      auditId: true, referenceCaId: true, status: true, fundSource: true, budgetRequested: true,
    } }),
  ]);
  const errors = []; const reviews = [];
  for (const remit of remits.filter(r => /^(Verified|Voided)$/i.test(r.status || ''))) {
    if (!remit.orNumber) { errors.push(`Remittance ${remit.submissionId}: no issued OR number`); continue; }
    const lines = receipts.filter(c => c.orNumber === remit.orNumber || c.orNumber.startsWith(`${remit.orNumber}-P`));
    const live = lines.filter(c => !inactive(c.status) && !inactive(c.paymentType));
    if (remit.status === 'Verified') {
      if (!live.length || cents(live.reduce((n,c)=>n+Number(c.amountPaid),0)) !== cents(remit.amountPaid))
        errors.push(`Remittance ${remit.submissionId}: approved amount or receipt status mismatch`);
    } else if (live.length) {
      errors.push(`Remittance ${remit.submissionId}: voided approval still has live receipt allocations`);
    } else if (!lines.length) reviews.push(`Voided remittance ${remit.submissionId}: receipt lines not found`);
  }
  for (const ca of advances) {
    const caAudits = audits.filter(a => a.referenceCaId === ca.advanceId && !inactive(a.status));
    if (ca.status === 'Liquidated' && caAudits.length !== 1)
      errors.push(`Advance ${ca.advanceId}: liquidated without one active audit`);
    if (inactive(ca.status) && caAudits.length)
      errors.push(`Advance ${ca.advanceId}: canceled but an active audit exists`);
    if (caAudits.length > 1)
      errors.push(`Advance ${ca.advanceId}: multiple active audits`);
  }
  console.log(`CLEAR Reversal Link Audit — READ ONLY\n${org.name} | ${ay} | ${term}`);
  console.log(`${remits.length} online remittances, ${receipts.length} OR lines, ${advances.length} advances, ${audits.length} liquidations`);
  for (const e of errors) console.log('ERROR:',e);
  for (const e of reviews) console.log('REVIEW:',e);
  console.log(`Results: ${errors.length} error(s), ${reviews.length} review item(s). No records modified.`);
  if (errors.length) process.exitCode=1;
})().catch(e=>{console.error('Audit failed:',e.message);process.exitCode=2;}).finally(()=>prisma.$disconnect());
