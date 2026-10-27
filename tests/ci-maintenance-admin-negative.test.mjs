import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const db = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' || process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== db || process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('Refusing Global Administrator negative test outside isolated CI.');
}
const prisma = new PrismaClient();
test('actual maintenance Server Action denies unauthenticated activation', { timeout:30000 }, async ()=>{
  try {
    const before=await prisma.maintenancePolicy.findMany();
    const auditBefore=await prisma.maintenanceAudit.count();
    const response=await fetch('http://127.0.0.1:3100/api/ci-maintenance-admin-negative',{
      method:'POST',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json'},body:'{}',
    });
    assert.equal(response.status,403,await response.text());
    const after=await prisma.maintenancePolicy.findMany();
    assert.deepEqual(after,before,'Unauthenticated action must not alter policy');
    assert.equal(await prisma.maintenanceAudit.count(),auditBefore,
      'Unauthenticated action must not create an audit entry');
    const page=await fetch('http://127.0.0.1:3100/dashboard/provisions/maintenance',
      {signal:AbortSignal.timeout(15000)});
    assert.equal(page.status,200);
    const html=await page.text();
    assert.match(html,/Global Administrator maintenance recovery/i);
    assert.doesNotMatch(html,/Recent immutable maintenance audit/i,
      'Unauthenticated web request must not receive admin records');
  } finally { await prisma.$disconnect(); }
});
