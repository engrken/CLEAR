/**
 * CLEAR UNIVERSAL PENALTY FUND BOOTSTRAP
 * node scripts/seed-penalty-funds.cjs                  -> dry run (no writes)
 * node scripts/seed-penalty-funds.cjs --apply          -> create missing ZERO-opening funds
 * node scripts/seed-penalty-funds.cjs --apply janitorial -> one tenant
 *
 * Only CURRENT active academic periods are seeded; closed historical periods
 * remain untouched. Historical receipts never move funds automatically.
 */
'use strict';
try { require('@next/env').loadEnvConfig(process.cwd()); }
catch (_) { /* environment supplied by process */ }
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const FUND = 'Penalty Fund';
const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const slug = argv.find(v => !v.startsWith('--'));
if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
  console.error('Invalid tenant slug.'); process.exit(1);
}
async function main() {
  const orgs = await prisma.organization.findMany({
    where: { ...(slug ? { subdomain: slug } : {}), status: 'Active' },
    select: { id: true, name: true, subdomain: true, activeAy: true, activeTerm: true },
    orderBy: { subdomain: 'asc' },
  });
  if (!orgs.length) throw new Error('No active tenants matched. No changes made.');
  let existing = 0, created = 0;
  for (const org of orgs) {
    const period = { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm, fundName: FUND };
    const found = await prisma.fund.findUnique({
      where: { organizationId_academicYear_term_fundName: period },
    });
    if (found) {
      console.log(`EXISTS   ${org.subdomain} | ${org.activeAy} / ${org.activeTerm} | ${FUND} | opening ₱${Number(found.initialAllocation).toFixed(2)}`);
      existing++;
      continue;
    }
    if (!apply) {
      console.log(`WOULD ADD ${org.subdomain} | ${org.activeAy} / ${org.activeTerm} | ${FUND} | opening ₱0.00`);
    } else {
      const result = await prisma.$transaction(async (tx) => {
        const createdFund = await tx.fund.upsert({
          where: { organizationId_academicYear_term_fundName: period },
          create: { ...period, initialAllocation: 0, currentBalance: 0 },
          update: {},
        });
        // Audit the bootstrap, not the legacy receipts. Running again does nothing.
        await tx.systemLog.create({
          data: { organizationId: org.id, user: 'System Bootstrap', action: 'CREATE_PENALTY_FUND',
            details: `Created/ensured ${FUND} for ${org.activeTerm} (${org.activeAy}) with zero opening allocation. No receipts or transfers were changed.` },
        });
        return createdFund;
      });
      console.log(`CREATED  ${org.subdomain} | ${org.activeAy} / ${org.activeTerm} | ${result.fundName}`);
    }
    created++;
  }
  console.log(`\nMode: ${apply ? 'APPLY' : 'DRY RUN'}; existing=${existing}; ${apply ? 'created/ensured' : 'would create'}=${created}`);
  console.log('Historical receipt allocations were not modified.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
