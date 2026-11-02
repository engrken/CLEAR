import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isMobileRequestAllowed, canRunMobileRosterWrites } from '../lib/mobile/production-readonly.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const rosterPath = '/api/mobile/orgs/jiecep/students/manage';

test('roster API can never open from financial or generic business-write flags', () => {
  assert.equal(isMobileRequestAllowed('POST', rosterPath, {
    vercelEnv: 'production', gitRef: 'main', financialWritesEnabled: true, tenantOperationsEnabled: true,
  }), false);
  assert.equal(isMobileRequestAllowed('POST', rosterPath), false);
  assert.equal(isMobileRequestAllowed('DELETE', rosterPath, {
    vercelEnv: 'production', gitRef: 'main', rosterWritesEnabled: true,
  }), false);
  assert.equal(isMobileRequestAllowed('POST', rosterPath, {
    vercelEnv: 'production', gitRef: 'feature/other', rosterWritesEnabled: true,
  }), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/jiecep/students', {
    vercelEnv: 'production', gitRef: 'main', rosterWritesEnabled: true,
  }), false);
});

test('roster gate only admits independently enabled server and approved deployment', () => {
  const prod = { vercelEnv: 'production', gitRef: 'main', rosterWritesEnabled: true };
  const staging = {
    vercelEnv: 'preview', gitRef: 'feature/android-v1.5.0-write-foundation-20261101',
    rosterWritesEnabled: true, localRosterCiOnly: true,
  };
  assert.equal(canRunMobileRosterWrites(prod), true);
  assert.equal(canRunMobileRosterWrites(staging), true);
  assert.equal(canRunMobileRosterWrites({ ...staging, localRosterCiOnly: false }), false,
    'Vercel Preview must never be sufficient for roster writes');
  assert.equal(isMobileRequestAllowed('POST', rosterPath, { ...staging, localRosterCiOnly: false }), false);
  assert.equal(isMobileRequestAllowed('POST', rosterPath, prod), true);
  assert.equal(isMobileRequestAllowed('POST', rosterPath, staging), true);
  assert.equal(isMobileRequestAllowed('POST', rosterPath, { ...prod, rosterWritesEnabled: false }), false);
  assert.equal(isMobileRequestAllowed('POST', '/api/mobile/orgs/../students/manage', prod), false);
});

test('roster endpoint rejects non-student tabs and caller-defined tenant/academic scope', () => {
  const route = read('app/api/mobile/orgs/[org]/students/manage/route.ts');
  const service = read('lib/mobile/student-roster-write.ts');
  const capabilities = read('app/api/mobile/orgs/[org]/write-capabilities/route.ts');
  assert.match(route, /requireMobileOfficer\(req, slug, 'tab-students'\)/);
  assert.match(route, /canRunMobileRosterWrites\(mobileRosterWriteEnvironment\(\)\)/);
  assert.match(capabilities, /canRunMobileRosterWrites\(mobileRosterWriteEnvironment\(\)\)/);
  assert.match(read('lib/mobile/http.ts'), /\.\.\.mobileRosterWriteEnvironment\(\)/);
  assert.match(route, /readJson<Record<string, unknown>>\(req\)/);
  assert.match(service, /organizationId: org.id/);
  assert.match(service, /org.activeAy/);
  assert.match(service, /org.activeTerm/);
  assert.match(service, /Prisma.TransactionIsolationLevel.Serializable/);
  assert.match(service, /'P2002', 'P2034'/);
  assert.match(service, /STUDENT_EMAIL_IDENTITY_REVIEW/);
  assert.match(service, /tx.collection.count/);
  assert.match(service, /tx.penalty.count/);
  assert.match(service, /tx.onlineRemittance.count/);
  assert.match(service, /tx.collectible.findFirst/);
  assert.match(service, /academicPeriodTransition.findUnique/);
  assert.match(service, /tx.organization.findUnique/);
  assert.match(service, /currentOrg.activeAy !== org.activeAy/);
  assert.match(service, /currentOrg.activeTerm !== org.activeTerm/);
  assert.match(capabilities, /hasTabAccess\(officer.role, officer.allowedTabs, 'tab-students'\)/);
  assert.match(capabilities, /'students.create', 'students.update', 'students.enrollment'/);
});

test('roster data never returns student email to payment-only officers', () => {
  const route = read('app/api/mobile/orgs/[org]/students/route.ts');
  const data = read('lib/mobile/data.ts');
  assert.match(route, /hasTabAccess\(officer.role, officer.allowedTabs, 'tab-students'\)/);
  assert.match(data, /includePrivateEmail = false/);
  assert.match(data, /\.\.\.\(includePrivateEmail \? \{ email: s.email \?\? null \} : \{\}\)/);
  assert.match(data, /includePrivateEmail \? \[\{ email: \{ contains: q/);
});

test('Android roster editor fails closed without server grant or trusted email review', () => {
  const ui = read('mobile/src/app/(officer)/students.tsx');
  const config = read('mobile/src/api/config.ts');
  const actions = read('mobile/src/lib/write-permissions.ts');
  assert.match(config, /STUDENT_ROSTER_WRITES_ENABLED = process\.env\.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES === 'true'/);
  assert.match(config, /EXPO_PUBLIC_CLEAR_RELEASE_KIND !== 'live-readonly-internal'/);
  assert.match(ui, /canOfferMobileWrite\(capability.data, 'students.create'/);
  assert.match(ui, /canOfferMobileWrite\(capability.data, 'students.update'/);
  assert.match(ui, /emailChanged && !verifiedIdentity/);
  assert.match(ui, /expected: snapshot\(student\)/);
  assert.match(actions, /'students.create'/);
  assert.match(actions, /'students.enrollment'/);
});

test('Android roster searches server-side beyond the first 500 loaded records', () => {
  const source = read('mobile/src/app/(officer)/students.tsx');
  assert.match(source, /api\.listStudents\(session, serverSearch \|\| undefined, canView && missingEmailOnly\)/);
  assert.match(source, /setTimeout\(\(\) => setServerSearch\(q\.trim\(\)\), 320\)/);
  assert.match(source, /:roster:/);
});
