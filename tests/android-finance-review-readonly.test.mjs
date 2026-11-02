import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULE_CATALOG, grantedModules } from '../mobile/src/lib/module-access.ts';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const tabs = [
  ['penalties', 'tab-penalties'],
  ['advances', 'tab-advances'],
  ['liquidations', 'tab-audit'],
  ['collections', 'tab-payment'],
];

test('each native finance module is grant-filtered and has its own secure web counterpart', () => {
  const moduleTabs = new Set(tabs.map(([, tab]) => tab));
  for (const [kind, tab] of tabs) {
    const item = MODULE_CATALOG.find(m => m.tab === tab);
    assert.ok(item, kind);
    assert.equal(item.availability, 'review-only');
    assert.ok(item.webPath?.startsWith('/'));
    assert.equal(grantedModules([tab]).filter(m => moduleTabs.has(m.tab)).length, 1);
    assert.equal(grantedModules(['tab-overview']).filter(m => m.tab === tab).length, 0);
  }
  assert.equal(grantedModules([]).filter(m => moduleTabs.has(m.tab)).length, 0);
});

test('financial review backend has a live role-specific authorization gate before any money query', () => {
  const route = read('app/api/mobile/orgs/[org]/finance-review/route.ts');
  for (const [kind, tab] of tabs) {
    assert.match(route, new RegExp(kind + ": '" + tab + "'"));
  }
  const required = route.indexOf('await requireMobileOfficer(req, slug, PERMISSION[mode])');
  assert.ok(required > -1, 'server must independently recheck active role, tab and tenant');
  for (const query of [
    'prisma.penalty.findMany', 'prisma.cashAdvance.findMany',
    'prisma.audit.findMany', 'prisma.collection.findMany',
  ]) {
    assert.ok(route.indexOf(query) > required, query + ' appears before permission check');
  }
  assert.match(route, /organizationId: org\.id, academicYear: org\.activeAy, term: org\.activeTerm/);
  assert.match(route, /hasOwnProperty\.call\(PERMISSION, kind\)/);
  assert.match(route, /PAGE_LIMIT = 40/);
  assert.match(route, /take = limit \+ 1/);
  assert.match(route, /hasMore: paged\.hasMore/g);
  assert.match(route, /nextCursor: paged\.nextCursor/g);
  assert.match(route, /parseCursor\(query\.get\('cursor'\), org\.id, org\.activeAy, org\.activeTerm, mode\)/);
  assert.match(route, /where: pageWhere\('timestamp'\)/);
  assert.match(route, /toCentavos\(/);
  assert.match(route, /NOT one row per official receipt/);
  assert.match(route, /Original approved advance \(not current outstanding\)/);
  assert.match(route, /Remaining penalty balance/);
  assert.match(route, /Individual receipt allocation line \(not full OR total\)/);
  assert.doesNotMatch(route, /prisma\.[a-zA-Z]+\.(create|update|upsert|delete|createMany|updateMany|deleteMany)\(/);
  assert.doesNotMatch(route, /export const (POST|PUT|PATCH|DELETE)\b/);
  assert.match(route, /export const OPTIONS = preflight/);
});

test('native financial records screen blocks ungranted modes and never submits financial writes', () => {
  const screen = read('mobile/src/app/(officer)/finance-review.tsx');
  const menu = read('mobile/src/app/(officer)/more.tsx');
  const layout = read('mobile/src/app/(officer)/_layout.tsx');
  const http = read('mobile/src/api/http.ts');
  const type = read('mobile/src/api/types.ts');
  for (const [kind, tab] of tabs) {
    assert.ok(screen.includes("kind: '" + kind + "'"), kind);
    assert.ok(screen.includes("tab: '" + tab + "'"), tab);
    assert.ok(menu.includes("'" + tab + "'"), tab);
    assert.ok(layout.includes("can('" + tab + "')"), tab);
  }
  assert.match(screen, /const allowed = MODES\.filter\(m => can\(m\.tab\)\)/);
  assert.match(screen, /const review = useFinanceReviewPages\(/);
  assert.match(screen, /review\.loading \|\| \(review\.data && review\.data\.kind !== mode\?\.kind\)/);
  assert.match(screen, /loadMore\(\)/);
  assert.match(screen, /Older records on web/);
  assert.match(screen, /Multiple rows can belong to one official receipt/);
  assert.match(screen, /no mobile token is passed/);
  assert.match(menu, /router\.push\(\{ pathname: '\/finance-review'/);
  assert.match(layout, /name="finance-review"/);
  assert.match(http, /getFinanceReview: \(s, kind, limit = 20, cursor\) => request/);
  assert.match(http, /finance-review/);
  assert.match(type, /getFinanceReview\(s: Session, kind: FinanceReviewKind, limit\?: number, cursor\?: string\)/);
  assert.doesNotMatch(screen, /recordPayment\(|submitProof\(|verifyRemittance\(|invalidateRemittance\(|executeVoidTransaction\(/);
  assert.doesNotMatch(screen, /method:\s*'POST'/);
});

test('production safety flags unchanged in Android and web handlers', () => {
  const config = read('mobile/src/api/config.ts');
  const access = read('lib/mobile/production-readonly.ts');
  assert.match(config, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(config, /MOBILE_BUSINESS_WRITES_ENABLED = false/);
  assert.match(access, /never authorize financial or business mutations/);
});
