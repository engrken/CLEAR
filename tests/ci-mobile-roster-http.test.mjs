// Authenticated mobile Student Roster integration, against disposable CircleCI
// PostgreSQL ONLY. Writes never reach Vercel or a production database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const LOCAL_DATABASE = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' ||
    process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== LOCAL_DATABASE ||
    process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSING Student Roster integration test outside disposable local CI PostgreSQL.');
}
const prisma = new PrismaClient();
const liveHost = 'http://127.0.0.1:3103';
const deniedHost = 'http://127.0.0.1:3100';
const ay = 'A.Y. 2026 - 2027';
const term = '1st Sem';

async function session(org, allowedTabs, role = 'Officer', status = 'Active') {
  const u = randomUUID().slice(0, 12);
  const officer = await prisma.tenantUser.create({
    data: { organizationId: org.id, userId: 'CI-ROSTER-' + u,
      fullName: 'Synthetic Roster Officer', username: 'ci_roster_' + u,
      email: 'ci-roster-' + u + '@example.invalid',
      status, role, allowedTabs: JSON.stringify(allowedTabs) },
  });
  const token = 'clr_' + randomBytes(32).toString('base64url');
  await prisma.mobileSession.create({ data: {
    id: randomUUID(), organizationId: org.id, tenantUserId: officer.id,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  } });
  return { token, officer };
}

async function send(slug, token, method, path, body, host = liveHost) {
  const res = await fetch(host + '/api/mobile/orgs/' + slug + path, {
    method, headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, body: await res.json() };
}
const get = (slug, token, path) => send(slug, token, 'GET', path);
const post = (slug, token, body, host) => send(slug, token, 'POST', '/students/manage', body, host);
const snapshot = row => ({
  studentId: row.studentId, fullName: row.fullName, yearLevel: row.yearLevel,
  email: row.email ?? null,
  enrollmentStatus: row.enrollmentStatus === 'Enrolled' ? 'Enrolled' : 'Inactive',
});

test('Student Roster: current session authorization, PII scope and audited optimistic writes', {
  timeout: 180_000,
}, async () => {
  const suffix = randomUUID().slice(0, 8);
  const org = await prisma.organization.create({ data: {
    subdomain: 'ci-roster-' + suffix, name: 'CI Synthetic Roster',
    type: 'Department', status: 'Active', activeAy: ay, activeTerm: term,
  } });
  const foreign = await prisma.organization.create({ data: {
    subdomain: 'ci-foreign-' + suffix, name: 'CI Foreign Department',
    type: 'Department', status: 'Active', activeAy: ay, activeTerm: term,
  } });
  try {
    const allowed = await session(org, ['tab-students']);
    const paymentOnly = await session(org, ['tab-payment']);
    const otherTenant = await session(foreign, ['tab-students']);
    const revoked = await session(org, ['tab-students'], 'Officer', 'Inactive');
    const initial = await prisma.student.create({ data: {
      organizationId: org.id, studentId: 'CI-ROSTER-OLD-' + suffix,
      fullName: 'Synthetic Person One', yearLevel: '1st Year',
      email: 'initial-' + suffix + '@example.invalid',
    } });
    await prisma.enrollment.create({ data: {
      organizationId: org.id, studentId: initial.id, academicYear: ay, term,
      enrollmentStatus: 'Enrolled', updatedBy: 'CI test',
    } });
    const foreignStudent = await prisma.student.create({ data: {
      organizationId: foreign.id, studentId: 'CI-FR-' + suffix,
      fullName: 'Other Tenant Record', yearLevel: '1st Year',
    } });
    const create = {
      action: 'create', studentId: 'CI-ROSTER-NEW-' + suffix,
      fullName: 'Synthetic Person Two', yearLevel: '2nd Year',
      email: 'new-' + suffix + '@example.invalid', enrollmentStatus: 'Enrolled',
    };

    assert.equal((await post(org.subdomain, null, create)).status, 401);
    assert.equal((await post(org.subdomain, paymentOnly.token, create)).status, 403);
    assert.equal((await post(org.subdomain, otherTenant.token, create)).status, 403);
    assert.equal((await post(org.subdomain, revoked.token, create)).status, 401);
    assert.equal((await post(org.subdomain, allowed.token, create, deniedHost)).status, 403,
      'Default server configuration must refuse roster edits regardless of role');

    const cap = await get(org.subdomain, allowed.token, '/write-capabilities');
    assert.equal(cap.status, 200, JSON.stringify(cap.body));
    assert.equal(cap.body.enabled, true);
    assert.deepEqual(cap.body.grants.map(grant => grant.action).sort(),
      ['students.create', 'students.enrollment', 'students.update']);
    assert.ok(cap.body.grants.every(grant => grant.organization === org.subdomain));
    const deniedCap = await get(org.subdomain, paymentOnly.token, '/write-capabilities');
    assert.equal(deniedCap.status, 200);
    assert.equal(deniedCap.body.enabled, false);
    assert.deepEqual(deniedCap.body.grants, []);

    const paymentRoster = await get(org.subdomain, paymentOnly.token, '/students');
    assert.equal(paymentRoster.status, 200);
    const limited = paymentRoster.body.find(student => student.id === initial.id);
    assert.ok(limited);
    assert.equal(Object.hasOwn(limited, 'email'), false, 'Payment-only officers cannot see student email');
    assert.equal((await get(org.subdomain, paymentOnly.token, '/students?email=missing')).status, 403);
    const privateSearch = await get(org.subdomain, paymentOnly.token,
      '/students?q=' + encodeURIComponent(initial.email));
    assert.equal(privateSearch.status, 200);
    assert.equal(privateSearch.body.length, 0, 'Payment-only officers cannot search private emails');

    const roster = await get(org.subdomain, allowed.token, '/students');
    assert.equal(roster.status, 200);
    const original = roster.body.find(student => student.id === initial.id);
    assert.equal(original.email, initial.email);
    assert.equal(original.enrollmentStatus, 'Enrolled');

    const before = await Promise.all([
      prisma.collection.count({ where: { organizationId: org.id } }),
      prisma.penalty.count({ where: { organizationId: org.id } }),
      prisma.onlineRemittance.count({ where: { organizationId: org.id } }),
    ]);
    const added = await post(org.subdomain, allowed.token, create);
    assert.equal(added.status, 200, JSON.stringify(added.body));
    assert.equal(added.body.success, true);
    const duplicate = await post(org.subdomain, allowed.token, create);
    assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body));
    const stored = await prisma.student.findUniqueOrThrow({ where: { id: added.body.id } });
    assert.equal(stored.email, create.email);
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { organizationId_academicYear_term_studentId: {
        organizationId: org.id, academicYear: ay, term, studentId: stored.id,
      } },
    });
    assert.equal(enrollment.enrollmentStatus, 'Enrolled');

    const baseUpdate = { action: 'update', id: initial.id, expected: snapshot(original),
      studentId: initial.studentId, fullName: 'Updated Synthetic Person',
      yearLevel: '2nd Year', email: 'changed-' + suffix + '@example.invalid',
      enrollmentStatus: 'Enrolled' };
    const noReview = await post(org.subdomain, allowed.token,
      { ...baseUpdate, emailChangeIdentityVerified: false });
    assert.equal(noReview.status, 403, JSON.stringify(noReview.body));
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: initial.id } })).email, initial.email);

    const updated = await post(org.subdomain, allowed.token,
      { ...baseUpdate, emailChangeIdentityVerified: true });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const latest = await prisma.student.findUniqueOrThrow({ where: { id: initial.id } });
    assert.equal(latest.fullName, baseUpdate.fullName);
    assert.equal(latest.email, baseUpdate.email);
    const stale = await post(org.subdomain, allowed.token,
      { ...baseUpdate, emailChangeIdentityVerified: true });
    assert.equal(stale.status, 409, JSON.stringify(stale.body));
    const crossId = await post(org.subdomain, allowed.token,
      { ...baseUpdate, id: foreignStudent.id });
    assert.equal(crossId.status, 404, JSON.stringify(crossId.body));

    const afterUpdate = (await get(org.subdomain, allowed.token, '/students')).body
      .find(row => row.id === initial.id);
    const inactive = await post(org.subdomain, allowed.token, {
      action: 'enrollment', id: initial.id, enrollmentStatus: 'Inactive',
      expected: snapshot(afterUpdate),
    });
    assert.equal(inactive.status, 200, JSON.stringify(inactive.body));
    assert.equal(inactive.body.status, 'Inactive');
    const savedEnrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { organizationId_academicYear_term_studentId: {
        organizationId: org.id, academicYear: ay, term, studentId: initial.id,
      } },
    });
    assert.equal(savedEnrollment.enrollmentStatus, 'Inactive');

    await prisma.collection.create({ data: {
      organizationId: org.id, studentId: initial.id, studentName: latest.fullName,
      orNumber: 'CI-ROSTER-OR-' + suffix, itemDescription: 'Synthetic Membership',
      category: 'Membership', paymentType: 'Regular', fundAllocation: 'General Fund',
      academicYear: ay, term, amountPaid: 25, balanceDue: 0, standardRate: 25,
    } });
    const statusBeforeIdRewrite = (await get(org.subdomain, allowed.token, '/students')).body
      .find(row => row.id === initial.id);
    const rewrite = await post(org.subdomain, allowed.token, {
      action: 'update', id: initial.id, expected: snapshot(statusBeforeIdRewrite),
      studentId: 'CI-CHANGED-ID-' + suffix, fullName: latest.fullName,
      yearLevel: latest.yearLevel, email: latest.email,
      enrollmentStatus: 'Inactive', emailChangeIdentityVerified: false,
    });
    assert.equal(rewrite.status, 409, JSON.stringify(rewrite.body));
    assert.equal((await prisma.student.findUniqueOrThrow({ where: { id: initial.id } })).studentId,
      initial.studentId);

    // A closed term must refuse even an otherwise authorized roster change.
    const closedTransition = await prisma.academicPeriodTransition.create({ data: {
      organizationId: org.id, sourceAY: ay, sourceTerm: term,
      destinationAY: 'A.Y. 2027 - 2028', destinationTerm: '1st Sem',
      status: 'Closed', reason: 'CI roster closed-term acceptance',
      closedBy: 'CI Synthetic Officer',
    } });
    const beforeClosure = await Promise.all([
      prisma.student.count({ where: { organizationId: org.id } }),
      prisma.enrollment.count({ where: { organizationId: org.id } }),
      prisma.systemLog.count({ where: { organizationId: org.id } }),
    ]);
    const blockedCreate = await post(org.subdomain, allowed.token, {
      ...create, studentId: 'CI-CLOSED-' + suffix, email: null,
    });
    assert.equal(blockedCreate.status, 409, JSON.stringify(blockedCreate.body));
    assert.equal(blockedCreate.body.error.code, 'period_closed');
    const blockedUpdate = await post(org.subdomain, allowed.token, {
      action: 'enrollment', id: initial.id, enrollmentStatus: 'Enrolled',
      expected: snapshot(statusBeforeIdRewrite),
    });
    assert.equal(blockedUpdate.status, 409, JSON.stringify(blockedUpdate.body));
    assert.equal(blockedUpdate.body.error.code, 'period_closed');
    const afterClosure = await Promise.all([
      prisma.student.count({ where: { organizationId: org.id } }),
      prisma.enrollment.count({ where: { organizationId: org.id } }),
      prisma.systemLog.count({ where: { organizationId: org.id } }),
    ]);
    assert.deepEqual(afterClosure, beforeClosure, 'Closed-period requests must not modify the roster or audit log');
    await prisma.academicPeriodTransition.delete({ where: { id: closedTransition.id } });

    const logs = await prisma.systemLog.findMany({
      where: { organizationId: org.id,
        action: { in: ['CREATE_STUDENT', 'UPDATE_STUDENT', 'TOGGLE_STUDENT_STATUS', 'STUDENT_EMAIL_IDENTITY_REVIEW'] } },
    });
    assert.ok(logs.some(log => log.action === 'STUDENT_EMAIL_IDENTITY_REVIEW'));
    assert.ok(logs.some(log => log.action === 'TOGGLE_STUDENT_STATUS'));
    assert.ok(logs.some(log => log.action === 'CREATE_STUDENT'));
    assert.ok(logs.every(log => !String(log.details).includes(initial.email)),
      'No old student email may appear in an audit log');
    const after = await Promise.all([
      prisma.collection.count({ where: { organizationId: org.id } }),
      prisma.penalty.count({ where: { organizationId: org.id } }),
      prisma.onlineRemittance.count({ where: { organizationId: org.id } }),
    ]);
    assert.deepEqual(after, [before[0] + 1, before[1], before[2]],
      'Roster modifications must never issue/modify financial transactions');
    assert.equal(await prisma.student.count({ where: {
      organizationId: foreign.id, id: foreignStudent.id,
    } }), 1);
  } finally {
    // CI disposes its entire local DB; no live records are cleaned or modified.
    await prisma.$disconnect();
  }
});
