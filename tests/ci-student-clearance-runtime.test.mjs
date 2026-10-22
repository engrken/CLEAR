// Real HTTP + Prisma integration checks against a disposable PostgreSQL service.
// Synthetic identities only. This script refuses to run outside its CI sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { PrismaClient } from '@prisma/client';

const sandbox = process.env.CLEAR_CI_STUDENT_AUTH_TEST_ENABLED === '1' &&
  /(?:localhost|127\.0\.0\.1):5432\/student_ci(?:\?|$)/.test(process.env.DATABASE_URL || '') &&
  process.env.AUTH_URL === 'http://127.0.0.1:3112' &&
  process.env.AUTH_SECRET?.startsWith('ci-only-student-clearance-');
if (!sandbox) throw new Error('REFUSING student security tests outside isolated CI database');

const prisma = new PrismaClient();
const root = 'http://127.0.0.1:3112';
const fixture = {
  tenantA: 'ci-student-auth-first', tenantB: 'ci-student-auth-second',
  a: { id: 'ci-private-a', studentId: 'CI-ONLY-A-007', email: 'ci-a@example.invalid' },
  b: { id: 'ci-private-b', studentId: 'CI-ONLY-B-008', email: 'ci-b@example.invalid' },
  c: { id: 'ci-private-c', studentId: 'CI-ONLY-C-009', email: 'ci-c@example.invalid' },
};
let app;
let output = '';
let smtpServer;
const smtpSockets = new Set();
const mailMessages = [];

// Minimal local SMTP server: exercises the REAL Nodemailer transport and API
// without using an external provider, credentials or real student identities.
async function startLocalSmtp() {
  smtpServer = createServer(socket => {
    smtpSockets.add(socket);
    socket.on('close', () => smtpSockets.delete(socket));
    socket.on('error', () => {});
    socket.setEncoding('utf8');
    socket.write('220 ci-clear.test ESMTP ready\r\n');
    let buffer = '';
    let recording = false;
    let body = [];
    let recipient = '';
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\n')) {
        const idx = buffer.indexOf('\n');
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (recording) {
          if (line === '.') {
            mailMessages.push({ recipient, content: body.join('\n') });
            recording = false;
            body = [];
            socket.write('250 2.0.0 synthetic mail accepted\r\n');
          } else body.push(line.startsWith('..') ? line.slice(1) : line);
          continue;
        }
        if (/^EHLO\s/i.test(line) || /^HELO\s/i.test(line)) {
          socket.write('250-ci-clear.test\r\n250 AUTH PLAIN\r\n');
        } else if (/^AUTH PLAIN\s/i.test(line)) {
          socket.write('235 2.7.0 synthetic SMTP authenticated\r\n');
        } else if (/^MAIL FROM:/i.test(line)) {
          recipient = '';
          socket.write('250 2.1.0 OK\r\n');
        } else if (/^RCPT TO:/i.test(line)) {
          recipient = line.slice('RCPT TO:'.length).replace(/[<>]/g, '').trim().toLowerCase();
          socket.write('250 2.1.5 OK\r\n');
        } else if (/^DATA$/i.test(line)) {
          recording = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (/^QUIT$/i.test(line)) {
          socket.end('221 2.0.0 Bye\r\n');
        } else if (/^RSET$/i.test(line) || /^NOOP$/i.test(line)) {
          socket.write('250 2.0.0 OK\r\n');
        } else {
          socket.write('500 unsupported synthetic SMTP command\r\n');
        }
      }
    });
  });
  await new Promise((resolve, reject) => {
    smtpServer.once('error', reject);
    smtpServer.listen(2525, '127.0.0.1', () => {
      smtpServer.removeListener('error', reject);
      resolve();
    });
  });
}

const digest = (label, value) => crypto.createHmac('sha256', process.env.AUTH_SECRET)
  .update('mobile-student:' + label + ':' + value).digest('hex');

async function request(slug, route, method = 'GET', json, token) {
  const response = await fetch(root + '/api/mobile/orgs/' + slug + route, {
    signal: AbortSignal.timeout(15_000),
    method,
    headers: {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      'x-vercel-forwarded-for': '192.0.2.77',
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null),
    cache: response.headers.get('cache-control') };
}

async function seed() {
  for (const id of [fixture.tenantA, fixture.tenantB]) {
    await prisma.organization.create({
      data: { id, subdomain: id, name: 'Synthetic ' + id, status: 'Active',
        activeAy: 'A.Y. CI-ONLY-2026', activeTerm: '1st Sem' },
    });
  }
  await prisma.student.create({ data: { ...fixture.a,
    organizationId: fixture.tenantA, fullName: 'Synthetic Student A', yearLevel: '1st Year' } });
  await prisma.student.create({ data: { ...fixture.b,
    organizationId: fixture.tenantB, fullName: 'Synthetic Student B', yearLevel: '2nd Year' } });
  await prisma.student.create({ data: { ...fixture.c,
    organizationId: fixture.tenantA, fullName: 'Synthetic Student C', yearLevel: '3rd Year' } });
}

async function issueSyntheticCode(org, student, code, expired = false) {
  const identity = digest('identity', [org, student.studentId.toLowerCase(), student.email].join(':'));
  const identifier = 'clear-student:otp:' + identity;
  await prisma.verificationToken.upsert({
    where: { identifier }, create: { identifier,
      token: digest('otp', identity + ':' + code),
      expires: new Date(Date.now() + (expired ? -10_000 : 5 * 60_000)) },
    update: { token: digest('otp', identity + ':' + code),
      expires: new Date(Date.now() + (expired ? -10_000 : 5 * 60_000)) },
  });
  return identifier;
}

async function start() {
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3112'], {
    env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  app.stdout.on('data', v => { output += v.toString(); });
  app.stderr.on('data', v => { output += v.toString(); });
  for (let n = 0; n < 60; n++) {
    if (app.exitCode !== null) break;
    try {
      const res = await fetch(root + '/api/mobile/health', { signal: AbortSignal.timeout(2_000) });
      if (res.status < 500) return;
    } catch { /* booting */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Synthetic Next.js test server did not start: ' + output.slice(-1400));
}

test('student-only OTP, reuse, guesses, tenant/period isolation, minimal status, session revoke', { timeout: 120_000 }, async () => {
  try {
    await seed();
    await startLocalSmtp();
    await start();
    const { tenantA, tenantB, a, b, c: studentC } = fixture;

    // Real Next.js SSR privacy regression on synthetic organizations.
    // Anonymous school-ID lookups redirect before student/ledger evaluation.
    const legacyLookup = await fetch(root + '/department/' + tenantA +
      '/clearance?q=' + encodeURIComponent(a.studentId), { redirect: 'manual' });
    if ([307, 308].includes(legacyLookup.status)) {
      assert.equal(new URL(legacyLookup.headers.get('location'), root).pathname,
        '/department/' + tenantA + '/clearance', 'legacy student ID scrubbed from URL');
    } else {
      // Next.js may stream a 200 document containing a meta refresh if the
      // outer layout flushed before the Server Component called redirect().
      assert.equal(legacyLookup.status, 200, 'Next.js streaming redirect document');
      const streamed = await legacyLookup.text();
      assert.match(streamed, /NEXT_REDIRECT|http-equiv=["']refresh/i,
        'streamed document must navigate to a clean URL');
      assert.doesNotMatch(streamed, /RECORD NOT FOUND|CLEARED FOR SIGNING|CLEARANCE HOLD ACTIVE|Synthetic Student A/,
        'redirect cannot render an anonymous clearance result');
    }
    const browserPage = await fetch(root + '/department/' + tenantA + '/clearance');
    assert.equal(browserPage.status, 200, 'public private-inquiry form loads');
    const browserHtml = await browserPage.text();
    assert.match(browserHtml, /Private student clearance inquiry/);
    assert.match(browserHtml, /Paid via GCash or Maya/, 'public payment-proof form remains available without clearance lookup');
    assert.doesNotMatch(browserHtml, /RECORD NOT FOUND|CLEARANCE HOLD ACTIVE|CLEARED FOR SIGNING|api\.qrserver\.com/);
    assert.doesNotMatch(browserHtml, /Synthetic Student A|CI-ONLY-A-007/);
    const forgedCertificate = await fetch(root + '/department/' + tenantA +
      '/clearance?ay=A.Y.%20CI-ONLY-2026&term=1st%20Sem&q=' +
      encodeURIComponent(a.studentId) + '&sig=' + '0'.repeat(64));
    assert.equal(forgedCertificate.status, 200, 'bad signature gets generic invalid certificate');
    const forgedHtml = await forgedCertificate.text();
    assert.match(forgedHtml, /Invalid clearance certificate/);
    assert.doesNotMatch(forgedHtml, /Synthetic Student A|CLEARED FOR SIGNING|CLEARANCE ON HOLD/);


    // Real bearer-token/Prisma authorization checks for officer, tenant admin
    // and global admin. Everything is synthetic and runs only on CI's PostgreSQL.
    const officer = await prisma.tenantUser.create({
      data: { id: 'ci-officer-only', organizationId: tenantA, userId: 'CI-OFFICER',
        fullName: 'Synthetic Officer', username: 'ci-officer', email: 'ci-officer@example.invalid',
        role: 'officer', allowedTabs: JSON.stringify(['tab-students']), status: 'Active' },
    });
    const admin = await prisma.tenantUser.create({
      data: { id: 'ci-admin-only', organizationId: tenantA, userId: 'CI-ADMIN',
        fullName: 'Synthetic Admin', username: 'ci-admin', email: 'ci-admin@example.invalid',
        role: 'admin', allowedTabs: '[]', status: 'Active' },
    });
    async function officerToken(user) {
      const token = 'clr_' + crypto.randomBytes(32).toString('base64url');
      await prisma.mobileSession.create({
        data: { id: crypto.randomUUID(),
          tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
          tenantUserId: user.id, organizationId: user.organizationId,
          expiresAt: new Date(Date.now() + 60 * 60_000) },
      });
      return token;
    }
    const officerBearer = await officerToken(officer);
    const adminBearer = await officerToken(admin);
    const officerRoster = await request(tenantA, '/students', 'GET', undefined, officerBearer);
    assert.equal(officerRoster.status, 200, 'officer with student permission can view own tenant roster');
    assert.equal((await request(tenantA, '/dashboard', 'GET', undefined, officerBearer)).status, 403,
      'officer without overview tab cannot access dashboard');
    assert.equal((await request(tenantA, '/portal', 'GET', undefined, officerBearer)).status, 403,
      'ordinary officer can never access tenant-admin portal');
    assert.equal((await request(tenantB, '/students', 'GET', undefined, officerBearer)).status, 403,
      'officer bearer token cannot cross the tenant boundary');
    const tenantPortal = await request(tenantA, '/portal', 'GET', undefined, adminBearer);
    assert.equal(tenantPortal.status, 200, 'real tenant administrator can read own portal');
    assert.equal(tenantPortal.body?.mode, 'read_only');
    assert.equal(tenantPortal.body?.organization?.subdomain, tenantA);
    assert.equal((await request(tenantB, '/portal', 'GET', undefined, adminBearer)).status, 403,
      'tenant administrator cannot inspect another tenant');
    assert.equal((await request(tenantA, '/proofs', 'POST',
      { studentId: a.studentId, amountCentavos: 10000 }, adminBearer)).status, 403,
      'authenticated tenant administrator cannot create payment proofs through mobile');

    const globalToken = 'clrg_' + crypto.randomBytes(32).toString('base64url');
    await prisma.globalMobileSession.create({
      data: { tokenHash: crypto.createHash('sha256').update(globalToken).digest('hex'),
        adminEmail: 'ci-superadmin@example.invalid',
        globalAdminId: 'bootstrap', globalAdminVersion: 1,
        expiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    const globalView = await fetch(root + '/api/mobile/global/overview', {
      signal: AbortSignal.timeout(15_000), headers: { Authorization: 'Bearer ' + globalToken },
    });
    assert.equal(globalView.status, 200, 'verified global superadmin can view all tenants');
    const allOrgs = (await globalView.json()).organizations;
    assert.deepEqual(allOrgs.map(o => o.subdomain).sort(), [tenantA, tenantB].sort());
    const globalOtherTenant = await fetch(root + '/api/mobile/global/orgs/' + tenantB + '/students', {
      signal: AbortSignal.timeout(15_000), headers: { Authorization: 'Bearer ' + globalToken },
    });
    assert.equal(globalOtherTenant.status, 200, 'global admin can view a different tenant through global routes');
    assert.equal((await request(tenantA, '/portal', 'GET', undefined, globalToken)).status, 401,
      'global admin token must never impersonate a tenant administrator');
    const officerGlobal = await fetch(root + '/api/mobile/global/overview', {
      signal: AbortSignal.timeout(15_000), headers: { Authorization: 'Bearer ' + officerBearer },
    });
    assert.equal(officerGlobal.status, 401, 'tenant officer token cannot become global admin');
    await prisma.globalMobileSession.update({
      where: { tokenHash: crypto.createHash('sha256').update(globalToken).digest('hex') },
      data: { revokedAt: new Date() },
    });
    const revokedGlobal = await fetch(root + '/api/mobile/global/overview', {
      signal: AbortSignal.timeout(15_000), headers: { Authorization: 'Bearer ' + globalToken },
    });
    assert.equal(revokedGlobal.status, 401, 'global session revocation takes effect immediately');
    await prisma.tenantUser.update({ where: { id: officer.id }, data: { status: 'Inactive' } });
    assert.equal((await request(tenantA, '/students', 'GET', undefined, officerBearer)).status, 401,
      'deactivated officer has no further roster access');
    await prisma.mobileSession.updateMany({
      where: { tenantUserId: admin.id }, data: { revokedAt: new Date() },
    });
    assert.equal((await request(tenantA, '/portal', 'GET', undefined, adminBearer)).status, 401,
      'revoked tenant administrator session has no portal access');


    // Route middleware is the authoritative read-only boundary. Test the live
    // handlers, not only the pure allowlist, against disposable PostgreSQL.
    const financialPost = await request(tenantA, '/proofs', 'POST', {
      studentId: a.studentId, amountCentavos: 10000,
    });
    assert.equal(financialPost.status, 403, 'anonymous proof upload cannot reach business writes');
    assert.equal(financialPost.body?.error?.code, 'read_only');
    const tenantProvision = await fetch(root + '/api/mobile/global/provisions', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Forbidden synthetic tenant' }),
    });
    assert.equal(tenantProvision.status, 403, 'global tenant provisioning fails closed');
    assert.equal((await tenantProvision.json()).error?.code, 'read_only');
    const anonymousPortal = await request(tenantA, '/portal');
    assert.equal(anonymousPortal.status, 401, 'admin portal requires an active tenant credential');
    const anonymousLedger = await request(tenantA, '/ledger');
    assert.equal(anonymousLedger.status, 401, 'ledger is never anonymous');

    const anonymous = await request(tenantA, '/clearance?q=' + encodeURIComponent(a.studentId));
    assert.equal(anonymous.status, 401, 'school ID without an officer token cannot search');
    assert.match(anonymous.cache || '', /no-store/);

    const nonexistent = await request(tenantA, '/clearance/auth/request-code', 'POST', {
      studentId: 'CI-NO-ACCOUNT', email: 'ci-nobody@example.invalid',
    });
    assert.equal(nonexistent.status, 200);
    assert.match(nonexistent.body?.message || '', /If the student ID and registered email match/);
    assert.ok(!('studentId' in nonexistent.body));

    // Real request-code -> Nodemailer -> local SMTP -> real verification ->
    // own-record query. Never print plaintext OTP to CI logs.
    assert.equal(mailMessages.length, 0, 'unknown student must not cause email delivery');
    const wrongTenantCode = await request(tenantB, '/clearance/auth/request-code', 'POST', {
      studentId: studentC.studentId, email: studentC.email,
    });
    assert.equal(wrongTenantCode.status, 200, 'wrong-tenant request must be generic');
    assert.equal(mailMessages.length, 0, 'wrong-tenant student must never be emailed');
    const sent = await request(tenantA, '/clearance/auth/request-code', 'POST', {
      studentId: studentC.studentId, email: studentC.email,
    });
    assert.equal(sent.status, 200, 'existing student gets same generic acknowledgment');
    assert.equal(sent.body?.message, nonexistent.body?.message, 'response cannot disclose account existence');
    assert.equal(mailMessages.length, 1, 'real server sent exactly one synthetic OTP email');
    assert.equal(mailMessages[0].recipient, studentC.email,
      'send only to the registered address');
    assert.match(mailMessages[0].content, /CLEAR Student Clearance/);
    const codeFromEmail = /\b(\d{6})\b/.exec(mailMessages[0].content)?.[1];
    assert.match(codeFromEmail || '', /^\d{6}$/, 'synthetic SMTP captured a real six-digit OTP');
    const verifiedFromEmail = await request(tenantA, '/clearance/auth/verify-code', 'POST', {
      studentId: studentC.studentId, email: studentC.email, code: codeFromEmail,
    });
    assert.equal(verifiedFromEmail.status, 200, 'real email code must issue a short-lived student session');
    const privateResponse = await request(tenantA, '/clearance', 'GET', undefined, verifiedFromEmail.body.token);
    assert.equal(privateResponse.status, 200, 'student email credentials must read own status');
    assert.equal(privateResponse.body.studentId, null);
    assert.equal(privateResponse.body.studentName, null);
    assert.equal(privateResponse.body.outstandingCentavos, null);
    assert.equal((await request(tenantB, '/clearance', 'GET', undefined, verifiedFromEmail.body.token)).status, 401);
    assert.equal((await request(tenantA, '/clearance/auth/session', 'DELETE', undefined, verifiedFromEmail.body.token)).status, 204);


    const identifier = await issueSyntheticCode(tenantA, a, '123456');
    const bad = await request(tenantA, '/clearance/auth/verify-code', 'POST', {
      studentId: a.studentId, email: a.email, code: '123457',
    });
    assert.equal(bad.status, 400, 'wrong OTP is denied');

    const good = await request(tenantA, '/clearance/auth/verify-code', 'POST', {
      studentId: a.studentId, email: a.email, code: '123456',
    });
    assert.equal(good.status, 200, JSON.stringify(good.body));
    assert.match(good.body?.token || '', /^clrs_[A-Za-z0-9_-]+$/);
    assert.ok(!('studentId' in good.body));
    assert.equal(await prisma.verificationToken.findUnique({ where: { identifier } }), null);

    const replay = await request(tenantA, '/clearance/auth/verify-code', 'POST', {
      studentId: a.studentId, email: a.email, code: '123456',
    });
    assert.notEqual(replay.status, 200, 'OTP cannot be reused');

    const mine = await request(tenantA, '/clearance', 'GET', undefined, good.body.token);
    assert.equal(mine.status, 200, JSON.stringify(mine.body));
    assert.ok(['cleared', 'hold'].includes(mine.body?.status));
    assert.equal(mine.body.studentId, null);
    assert.equal(mine.body.studentName, null);
    assert.equal(mine.body.outstandingCentavos, null);
    assert.equal(mine.body.unpaidItems, null);
    assert.equal(mine.body.qrToken, null);
    assert.match(mine.cache || '', /no-store/);
    assert.equal(mine.body.ay, 'A.Y. CI-ONLY-2026');

    const crossTenant = await request(tenantB, '/clearance', 'GET', undefined, good.body.token);
    assert.equal(crossTenant.status, 401, 'student token from tenant A cannot read tenant B');
    const bypass = await request(tenantA, '/clearance?q=' + studentC.studentId, 'GET', undefined, good.body.token);
    assert.equal(bypass.status, 401, 'student token must never reveal another student in its own tenant');

    const revoked = await request(tenantA, '/clearance/auth/session', 'DELETE', undefined, good.body.token);
    assert.equal(revoked.status, 204);
    assert.equal((await request(tenantA, '/clearance', 'GET', undefined, good.body.token)).status, 401);

    await issueSyntheticCode(tenantA, a, '222222');
    const renewed = await request(tenantA, '/clearance/auth/verify-code', 'POST', {
      studentId: a.studentId, email: a.email, code: '222222',
    });
    assert.equal(renewed.status, 200, 'fresh OTP issues a fresh student session');
    await prisma.organization.update({
      where: { id: tenantA }, data: { activeTerm: '2nd Sem' },
    });
    assert.equal((await request(tenantA, '/clearance', 'GET', undefined, renewed.body.token)).status, 401,
      'academic period rollover invalidates existing student credentials');

    await issueSyntheticCode(tenantB, b, '654321', true);
    const expired = await request(tenantB, '/clearance/auth/verify-code', 'POST', {
      studentId: b.studentId, email: b.email, code: '654321',
    });
    assert.equal(expired.status, 400, 'expired OTP cannot be consumed');

    await issueSyntheticCode(tenantB, b, '654321');
    // The earlier expired-code verification already spent one of five guesses.
    for (let n = 0; n < 4; n++) {
      const guess = await request(tenantB, '/clearance/auth/verify-code', 'POST', {
        studentId: b.studentId, email: b.email, code: String(100000 + n),
      });
      assert.equal(guess.status, 400, 'wrong guesses stay denied');
    }
    const locked = await request(tenantB, '/clearance/auth/verify-code', 'POST', {
      studentId: b.studentId, email: b.email, code: '654321',
    });
    assert.equal(locked.status, 429, 'correct OTP cannot bypass per-account guess lock');

    const lockKey = 'clear-student:guess:' + digest('identity', [tenantB, b.studentId.toLowerCase(), b.email].join(':'));
    const lock = await prisma.authThrottle.findUnique({ where: { key: lockKey } });
    assert.ok(lock?.lockedUntil && lock.lockedUntil > new Date());
  } finally {
    if (app) app.kill('SIGTERM');
    for (const s of smtpSockets) s.destroy();
    if (smtpServer?.listening) await new Promise(resolve => smtpServer.close(resolve));
    await prisma.$disconnect();
  }
});
