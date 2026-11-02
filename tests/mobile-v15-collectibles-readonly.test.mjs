// v1.5.0 native Collectibles is a tenant-scoped, money-safe GET projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('native Collectibles stays strictly read-only and isolates tenant/period pages', () => {
  const route=source('app/api/mobile/orgs/[org]/collectibles/route.ts');
  const ui=source('mobile/src/app/(officer)/collectibles.tsx');
  const api=source('mobile/src/api/http.ts');
  const navigation=source('mobile/src/app/(officer)/_layout.tsx');
  const directory=source('mobile/src/lib/module-access.ts');
  const more=source('mobile/src/app/(officer)/more.tsx');
  assert.match(route, /requireMobileOfficer\(req, slug, 'tab-collectibles'\)/);
  assert.match(route, /organizationId: org\.id, academicYear: org\.activeAy, term: org\.activeTerm/);
  assert.match(route, /decodeCursor\(q\.get\('cursor'\), org\.id, org\.activeAy, org\.activeTerm\)/);
  assert.match(route, /orderBy: \{ id: 'desc' \}/);
  assert.match(route, /toCentavos\(row\.balanceDue\)/);
  assert.match(route, /row\.status\.split\('\|SID:'\)/);
  assert.doesNotMatch(route, /export const (?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(ui, /api\.recordPayment|manageTenantUser|submitProof|verifyRemittance/);
  assert.match(api, /listCollectibles: \(s, cursor\)/);
  assert.match(navigation, /Tabs\.Protected guard=\{can\('tab-collectibles'\)\}/);
  assert.match(directory, /tab: 'tab-collectibles'.*availability: 'review-only'/);
  assert.match(more, /tab === 'tab-collectibles'/);
});
