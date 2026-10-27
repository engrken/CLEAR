// Synthetic localhost-only comparison of baseline Next handler and
// identical handler through P3 proxy. No Production traffic or student data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const db = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' ||
    process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== db ||
    process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('Refusing to benchmark outside isolated CircleCI Postgres.');
}
const prisma = new PrismaClient();
const base = 'http://127.0.0.1:3100';
const baseline = '/api/auth/ci-maintenance-bench';
const protectedPath = '/api/ci-maintenance-bench';

function percentile(samples, fraction) {
  const sorted = [...samples].sort((a,b) => a-b);
  return sorted[Math.ceil(fraction * sorted.length)-1];
}
async function probe(path) {
  const began = performance.now();
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(10000),
    headers: { 'Cache-Control': 'no-cache' },
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.deepEqual(payload, { ok: true, name: 'maintenance-ci-benchmark' });
  return performance.now() - began;
}

test('P2: bound additional HTTP latency of P3 NORMAL proxy in isolated staging', {
  timeout: 120000,
}, async () => {
  try {
    const policies = await prisma.maintenancePolicy.findMany();
    assert.ok(policies.every(p=>p.mode==='NORMAL' ||
      (p.expiresAt !== null && p.expiresAt < new Date())),
      'A maintenance policy is active in the CI benchmark database');
    const samples = { exempt: [], proxy: [] };
    // Warm once to exclude route/module compilation and ORM connection setup.
    for(let i=0;i<12;i++) {
      await probe(i%2 ? protectedPath : baseline);
    }
    // Interleaved order limits traffic and warm-up bias.
    for(let i=0;i<60;i++) {
      const order = i%2 ? [protectedPath,baseline] : [baseline,protectedPath];
      for(const route of order) {
        const ms = await probe(route);
        samples[route===baseline?'exempt':'proxy'].push(ms);
      }
    }
    const stats = {};
    for(const [name,values] of Object.entries(samples)) {
      stats[name]={count:values.length,
        p50ms:Number(percentile(values,0.50).toFixed(2)),
        p95ms:Number(percentile(values,0.95).toFixed(2)),
        maxms:Number(Math.max(...values).toFixed(2))};
    }
    const overheadP95=Number((stats.proxy.p95ms-stats.exempt.p95ms).toFixed(2));
    const result={dataset:'disposable CircleCI Postgres and localhost Next.js',
      sampleType:'warm interleaved sequential requests',stats,
      overheadP95ms:overheadP95,
      warning:'Not Production/Vercel/Neon network p95; repeat in regional staging before release.'};
    console.log('P3_MAINTENANCE_PROXY_BENCHMARK '+JSON.stringify(result));
    writeFileSync('/tmp/clear-ci-maintenance-benchmark.json',JSON.stringify(result,null,2)+'\n');
    // Generous CI-specific guard: catches a pathological proxy DB query
    // without pretending to enforce an unagreed Production SLA.
    assert.ok(stats.proxy.p95ms < 500,
      'Unacceptable warm isolated proxy p95 above 500 ms');
    assert.ok(overheadP95 < 250,
      'P3 adds >250ms warm localhost p95 overhead');
  } finally {
    await prisma.$disconnect();
  }
});
