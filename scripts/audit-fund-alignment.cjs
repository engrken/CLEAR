/**
 * CLEAR FUND ALIGNMENT AUDITOR (READ ONLY).
 * Run from the CLEAR project root:
 * node scripts/audit-fund-alignment.cjs <department-slug> [academic-year] [term]
 * Example: node scripts/audit-fund-alignment.cjs janitorial "A.Y. 2026 - 2027" "1st Sem"
 * No database writes, no changes to files or settings.
 */
'use strict';

try { require('@next/env').loadEnvConfig(process.cwd()); }
catch (_) { /* DATABASE_URL can also come from the process environment */ }
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const norm = v => String(v ?? '').trim();
const key = v => norm(v).toLowerCase();
const cents = v => Math.round(Number(v ?? 0) * 100);
const cash = n => `PHP ${(n / 100).toFixed(2)}`;
const CARRY = 'General Fund (Carried Over)';

function dueIdentity(status) {
  const match = norm(status).match(/\|SID:([^|]+)\|ITEM:([^|]+)/);
  if (!match) return null;
  try { return { studentId: decodeURIComponent(match[1]), name: decodeURIComponent(match[2]) }; }
  catch (_) { return null; }
}
function isVoided(v) { return /VOID|CANCEL/i.test(norm(v)); }
function isOpenAdvance(v) {
  const s = norm(v).toUpperCase();
  return !isVoided(s) && (s.includes('UNLIQUIDATED') || s.includes('PENDING') || s === 'ACTIVE') &&
    !(s.includes('LIQUIDATED') && !s.includes('UNLIQUIDATED'));
}
function rolloverMetadata(reason) {
  const match = norm(reason).match(/\[\[CLEAR_ROLLOVER_V2:([A-Za-z0-9_-]+)\]\]/);
  if (!match) return null;
  try { return JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')); }
  catch (_) { return null; }
}
function isRollover(source) { return /\srollover$/i.test(norm(source)); }
function reportRow(issues, level, code, detail) { issues.push({ level, code, detail }); }

async function main() {
  const department = norm(process.argv[2]).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(department)) {
    throw new Error('Supply a valid department slug (example: janitorial).');
  }
  const org = await prisma.organization.findUnique({ where: { subdomain: department } });
  if (!org) throw new Error(`Organization '${department}' was not found.`);
  const ay = norm(process.argv[3]) || org.activeAy || 'A.Y. 2026 - 2027';
  const term = norm(process.argv[4]) || org.activeTerm || '1st Sem';
  const period = { organizationId: org.id, academicYear: ay, term };
  const [funds, fees, collections, collectibles, advances, audits, allTransfers, reversals, online, cashier, legacyRealign] =
    await Promise.all([
      prisma.fund.findMany({ where: period }),
      prisma.collectionSetup.findMany({ where: period }),
      prisma.collection.findMany({ where: period }),
      prisma.collectible.findMany({ where: period }),
      prisma.cashAdvance.findMany({ where: period }),
      prisma.audit.findMany({ where: period }),
      prisma.fundTransfer.findMany({ where: { organizationId: org.id } }),
      prisma.voidTransaction.findMany({ where: { organizationId: org.id, transactionType: 'ROLLOVER_REVERSAL' } }),
      prisma.onlineRemittance.findMany({ where: period }),
      prisma.cashierRemittance.findMany({ where: period }),
      prisma.fundRealignment.findMany({ where: { organizationId: org.id } }),
    ]);
  const issues = [];
  const names = new Set(funds.map(f => key(f.fundName)));
  const eligible = name => names.has(key(name)) || key(name) === key(CARRY);
  const known = name => names.has(key(name));
  const feeMatches = (category, name) => fees.filter(f => key(f.category) === key(category) && key(f.name) === key(name));
  const balances = new Map();
  const add = (fund, amount) => {
    const f = norm(fund) || CARRY;
    balances.set(f, (balances.get(f) || 0) + amount);
  };

  for (const fund of funds) {
    add(fund.fundName, cents(fund.initialAllocation));
    if (!norm(fund.fundName)) reportRow(issues, 'ERROR', 'EMPTY_FUND', `Blank fund name on Fund ${fund.id}`);
  }
  const feeKeys = new Map();
  for (const fee of fees) {
    const k = `${key(fee.category)}|${key(fee.name)}`;
    feeKeys.set(k, (feeKeys.get(k) || 0) + 1);
    if (!known(fee.targetFund)) reportRow(issues, 'ERROR', 'FEE_FUND_MISSING',
      `Fee '${fee.category} / ${fee.name}' -> '${fee.targetFund}' has no matching Fund for ${term} (${ay})`);
    if (!(Number.isFinite(fee.amount) && fee.amount > 0)) reportRow(issues, 'ERROR', 'FEE_AMOUNT',
      `Fee '${fee.category} / ${fee.name}' has invalid amount ${fee.amount}`);
  }
  for (const [k, count] of feeKeys) if (count > 1) reportRow(issues, 'ERROR', 'DUPLICATE_FEE_KEY',
    `Fee category/item '${k}' appears ${count} times; payments may resolve the wrong fee`);

  const receiptsByOr = new Map();
  for (const c of collections) {
    if (isVoided(c.status) || isVoided(c.paymentType)) continue;
    add(c.fundAllocation, cents(c.amountPaid));
    const o = key(c.orNumber);
    receiptsByOr.set(o, (receiptsByOr.get(o) || 0) + 1);
    const desc = norm(c.itemDescription);
    if (/^Penalty Fine\s*(?:\[|:)/i.test(desc)) {
      // System-wide policy: new penalty cash receipts go to Penalty Fund.
      // Older receipts in other funds are historical REVIEW items, not silently edited.
      if (key(c.fundAllocation) !== key('Penalty Fund')) {
        reportRow(issues, 'REVIEW', 'LEGACY_PENALTY_FUND',
          `Historical penalty receipt OR ${c.orNumber} -> '${c.fundAllocation}' (policy: Penalty Fund); retain audit history and review reclassification separately`);
      }
    } else if (!/^Departmental Fee (?:Package|\(Full Package\))/i.test(desc)) {
      const matches = feeMatches(c.category, desc);
      if (!matches.length) reportRow(issues, 'REVIEW', 'NO_SETUP_MATCH',
        `Receipt OR ${c.orNumber} '${c.category} / ${desc}' has no exact configured fee`);
      else if (matches.length === 1 && key(matches[0].targetFund) !== key(c.fundAllocation)) {
        reportRow(issues, 'ERROR', 'RECEIPT_FUND_MISMATCH',
          `OR ${c.orNumber} '${desc}' posted to '${c.fundAllocation}' but Fee Setup targets '${matches[0].targetFund}'`);
      }
    }
    if (!eligible(c.fundAllocation)) reportRow(issues, 'ERROR', 'RECEIPT_UNKNOWN_FUND',
      `OR ${c.orNumber} posted to unconfigured fund '${c.fundAllocation}'`);
  }

  const dueKeys = new Map();
  for (const due of collectibles) {
    const id = dueIdentity(due.status);
    if (!id) {
      if (cents(due.balanceDue) > 0 && !isVoided(due.status)) {
        reportRow(issues, 'REVIEW', 'UNLINKED_COLLECTIBLE',
          `Collectible ${due.id} (${due.category}, ${cash(cents(due.balanceDue))}) has no linked student/fee marker; check legacy bulk receivables`);
      }
      continue;
    }
    const matches = feeMatches(due.category, id.name).filter(f => f.isPackage === false);
    if (!matches.length) reportRow(issues, 'ERROR', 'COLLECTIBLE_FEE_MISSING',
      `Assessment ${due.id} for student ${id.studentId}: standalone fee '${due.category} / ${id.name}' is missing`);
    const dkey = `${key(id.studentId)}|${key(due.category)}|${key(id.name)}`;
    if (cents(due.balanceDue) > 0 && !isVoided(due.status)) dueKeys.set(dkey, (dueKeys.get(dkey) || 0) + 1);
  }
  for (const [k, count] of dueKeys) if (count > 1) reportRow(issues, 'ERROR', 'DUPLICATE_OPEN_DUE',
    `Student/category/item '${k}' has ${count} outstanding collectible assessments`);

  for (const advance of advances) {
    if (isOpenAdvance(advance.status)) add(advance.fundSource, -cents(advance.amountApproved));
    if (!eligible(advance.fundSource)) reportRow(issues, 'ERROR', 'ADVANCE_SOURCE_UNKNOWN',
      `Advance ${advance.advanceId} source '${advance.fundSource}' is not configured in this period`);
  }
  const advancesById = new Map(advances.map(a => [a.advanceId, a]));
  for (const audit of audits) {
    if (!isVoided(audit.status)) add(audit.fundSource, -cents(audit.totalExpense));
    if (!eligible(audit.fundSource)) reportRow(issues, 'ERROR', 'AUDIT_SOURCE_UNKNOWN',
      `Audit ${audit.auditId} source '${audit.fundSource}' is not configured in this period`);
    const related = advancesById.get(audit.referenceCaId);
    if (related && key(audit.fundSource) !== key(related.fundSource)) {
      reportRow(issues, 'ERROR', 'AUDIT_CA_SOURCE_MISMATCH',
        `Audit ${audit.auditId} uses '${audit.fundSource}', but cash advance ${related.advanceId} uses '${related.fundSource}'`);
    }
  }

  const reversedIds = new Set(reversals.map(r => r.referenceId));
  for (const transfer of allTransfers) {
    const rollover = isRollover(transfer.sourceFund);
    if (rollover && reversedIds.has(transfer.id)) continue;
    const meta = rolloverMetadata(transfer.reason);
    if (rollover && meta && meta.sourceAY === ay && meta.sourceTerm === term) {
      for (const split of meta.splits || []) add(split.name, -Number(split.cents || 0));
    }
    if (transfer.academicYear !== ay || transfer.term !== term) continue;
    if (rollover) {
      add(transfer.destinationFund, cents(transfer.amount));
      if (key(transfer.destinationFund) !== key(CARRY) && !known(transfer.destinationFund)) {
        reportRow(issues, 'REVIEW', 'ROLLOVER_DESTINATION',
          `Rollover ${transfer.id} targets unfamiliar pool '${transfer.destinationFund}'`);
      }
    } else {
      add(transfer.sourceFund, -cents(transfer.amount));
      add(transfer.destinationFund, cents(transfer.amount));
      if (!eligible(transfer.sourceFund) || !eligible(transfer.destinationFund)) {
        reportRow(issues, 'REVIEW', 'TRANSFER_POOL_NOT_CONFIGURED',
          `Transfer ${transfer.id}: '${transfer.sourceFund}' -> '${transfer.destinationFund}' includes a nonconfigured fund`);
      }
    }
  }
  for (const remit of online) {
    if (key(remit.status) !== 'verified') continue;
    if (!norm(remit.orNumber)) {
      reportRow(issues, 'ERROR', 'VERIFIED_MISSING_OR', `Verified online remittance ${remit.submissionId} has no OR`);
      continue;
    }
    if (!receiptsByOr.has(key(remit.orNumber))) {
      reportRow(issues, 'ERROR', 'VERIFIED_NO_RECEIPT',
        `Verified online remittance ${remit.submissionId} references OR ${remit.orNumber} but no valid collection was found`);
    }
  }
  let custodyCents = 0;
  for (const r of cashier) {
    if (key(r.status) !== 'remitted') continue;
    const change = r.type === 'Deposit' ? cents(r.amount) : r.type === 'Withdrawal' ? -cents(r.amount) : 0;
    custodyCents += change;
  }
  if (custodyCents < 0) reportRow(issues, 'ERROR', 'NEGATIVE_CASHIER_CUSTODY', `Cashier custody is ${cash(custodyCents)}`);
  if (legacyRealign.length) reportRow(issues, 'REVIEW', 'LEGACY_REALIGNMENTS',
    `${legacyRealign.length} FundRealignment record(s) exist for this organization; shared ledger only processes FundTransfer rows. Verify whether these are duplicated historical entries.`);
  for (const [fund, amount] of balances) if (amount < 0) {
    reportRow(issues, 'ERROR', 'NEGATIVE_FUND', `'${fund}' computed balance is ${cash(amount)}`);
  }
  const total = [...balances.values()].reduce((a, b) => a + b, 0);
  if (custodyCents > total) reportRow(issues, 'ERROR', 'CASHIER_GREATER_THAN_ASSETS',
    `Cashier custody ${cash(custodyCents)} exceeds remaining financial assets ${cash(total)}`);

  console.log(`\nCLEAR Fund Alignment Audit — READ ONLY`);
  console.log(`Organization: ${org.name} (${org.subdomain})`);
  console.log(`Period: ${term} (${ay})`);
  console.log(`Records: ${funds.length} funds, ${fees.length} fees, ${collections.length} receipts, ${collectibles.length} dues, ${advances.length} advances, ${audits.length} audits`);
  console.log('\nReconstructed fund balances (from initial allocations + transaction history):');
  for (const [fund, amt] of [...balances].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${fund.padEnd(36)} ${cash(amt)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(36)} ${cash(total)}`);
  console.log(`  ${'Cashier custody (not additional income)'.padEnd(36)} ${cash(custodyCents)}`);
  const counts = { ERROR: 0, REVIEW: 0 };
  for (const item of issues) counts[item.level]++;
  console.log(`\nIssues: ${counts.ERROR} error(s), ${counts.REVIEW} review item(s)`);
  issues.forEach((item, idx) => console.log(`${String(idx + 1).padStart(3)}. [${item.level} / ${item.code}] ${item.detail}`));
  console.log('\nNotes: snapshots/legacy records may need manual review. The Fund.currentBalance column is not the shared-ledger source of truth. This script makes NO changes.');
  if (counts.ERROR) process.exitCode = 2;
}
main().catch(error => { console.error(`Audit aborted: ${error.message || error}`); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
