import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { qrcode } from '../lib/vendor/qrcode.mjs';
import { issueClearanceCertificate, readClearanceCertificate, CERTIFICATE_VALIDITY_MS } from '../lib/clearance-opaque-token.ts';
const read = p => readFileSync(new URL('../' + p,import.meta.url),'utf8');

test('opaque certificate decrypts only with the trusted purpose-scoped server secret', () => {
  const previous = process.env.CLEARANCE_SALT;
  process.env.CLEARANCE_SALT = 'isolated-ci-only-not-a-real-production-secret-2026';
  try {
    const claims = { orgId:'org-synthetic', studentPk:'student-pk-synthetic',
      studentId:'SYN-ACCT-1234', ay:'A.Y. 2026 - 2027', term:'1st Sem' };
    const now=Date.UTC(2026,9,25);
    const a = issueClearanceCertificate(claims,now);
    const b = issueClearanceCertificate(claims,now);
    assert.match(a,/^v3\.[a-zA-Z0-9_-]+$/);
    assert.notEqual(a,b,'nonce must be cryptographically random');
    assert.ok(!a.includes(claims.studentId));
    assert.deepEqual(readClearanceCertificate(a,now+1000),{
      ...claims,issuedAt:now,expiresAt:now+CERTIFICATE_VALIDITY_MS,
    });
    assert.equal(readClearanceCertificate(a,now+CERTIFICATE_VALIDITY_MS),null,'expires exactly at TTL');
    assert.equal(readClearanceCertificate(a,now-60_001),null,'future issuance is rejected');
    const middle=Math.floor(a.length/2);
    const tampered=a.slice(0,middle)+(a[middle]==='A'?'B':'A')+a.slice(middle+1);
    assert.equal(readClearanceCertificate(tampered,now+1000),null);
    assert.equal(readClearanceCertificate('v3.'+'A'.repeat(10000),now),null);
    process.env.CLEARANCE_SALT='different-isolated-secret-2026-not-production';
    assert.equal(readClearanceCertificate(a,now+1000),null,'rotated secrets invalidate token');
  } finally {
    if(previous===undefined)delete process.env.CLEARANCE_SALT;
    else process.env.CLEARANCE_SALT=previous;
  }
});
test('first-party QR SVG can encode the sealed URL without external network requests',()=>{
  const url='https://clearsys.vercel.app/clearance/verify?token=v3.'+'A'.repeat(240);
  const qr=qrcode(0,'M');qr.addData(url);qr.make();
  assert.ok(qr.getModuleCount()>20);
  const svg=qr.createSvgTag({cellSize:4,margin:16,scalable:true});
  assert.match(svg,/<svg/);
  assert.match(svg,/<path/);
  assert.doesNotMatch(svg,/qrserver|googleapis|<script|onload=/i);
  const component=read('app/department/[department]/clearance/FirstPartyClearanceQr.tsx');
  assert.match(component,/qrcode\(0, 'M'\)/);
  assert.match(component,/dangerouslySetInnerHTML/);
});
test('new QR URL is private, live-rechecked, expiring; old signature flow preserved',()=>{
  const web=read('app/department/[department]/clearance/page.tsx');
  const api=read('app/api/mobile/orgs/[org]/clearance/route.ts');
  const view=read('app/clearance/verify/page.tsx');
  const headers=read('next.config.ts');
  const student = read('app/department/[department]/clearance/StudentClearanceInquiry.tsx');
  assert.doesNotMatch(web,/issueClearanceCertificate\(/);
  assert.doesNotMatch(web,/<FirstPartyClearanceQr/);
  assert.match(student,/<FirstPartyClearanceQr url=\{result.qrToken\}/);
  assert.match(student,/result.status === 'cleared' && result.qrToken/);
  assert.match(web,/verifyClearanceSignature\(/,'legacy links still verify');
  assert.match(api,/requireStudentClearanceSession\(req, org\)/);
  assert.match(api,/result.student.id !== student.id/);
  assert.match(api,/getPeriodLedger\(prisma, org.id/);
  assert.match(api,/!ledger.activeRollover/);
  assert.match(api,/issueClearanceCertificate\(/);
  assert.doesNotMatch(api,/clearanceVerifyPath\(/,'new mobile officer QR should not expose school IDs');
  assert.match(view,/readClearanceCertificate\(/);
  assert.match(view,/current\.student\.id === claim\.studentPk/);
  assert.match(view,/current\?\.isCleared/);
  assert.match(view,/getPeriodLedger\(/);
  assert.match(view,/!periodLedger\.activeRollover/);
  assert.match(view,/org\.activeAy === claim\.ay && org\.activeTerm === claim\.term/);
  assert.doesNotMatch(view,/studentName|student\.fullName|unpaidItems\.map/);
  assert.match(headers,/source: '\/clearance\/verify'/);
  assert.match(headers,/Cache-Control.*no-store/);
  assert.match(headers,/Referrer-Policy.*no-referrer/);
});
test('missing roster-email remediation stays authorized and never introduces public ID fallback',()=>{
  const page=read('app/department/[department]/(protected)/students/page.tsx');
  const client=read('app/department/[department]/(protected)/students/StudentsClient.tsx');
  assert.match(page,/requireTabAccess\('tab-students', cleanDepartment\)/);
  assert.match(page,/studentsMissingEmail/);
  assert.match(client,/studentsMissingEmail/);
  assert.match(client,/Edit Student/);
  assert.match(client,/cannot bypass the clearance OTP requirement/);
  assert.doesNotMatch(read('app/api/mobile/orgs/[org]/clearance/route.ts'),/export const POST/);
});
test('Receipt History selective search fetches complete package groups before paging',()=>{
 const s=read('app/department/[department]/(protected)/collections/history/page.tsx');
 assert.match(s,/if \(q\.length >= 3 && !exactOr\)/);
 assert.match(s,/take: 151/);
 assert.match(s,/matching\.length <= 150/);
 assert.match(s,/bases\.size <= 60/);
 assert.match(s,/replace\(\/-P\\d\+\$\/i, ''\)/);
 assert.match(s,/receiptCandidates\.flatMap\(base =>/);
 assert.match(s,/buildIssuedReceipts\(allocationLines\)/);
 assert.match(s,/matched\.slice\(/);
 assert.match(s,/organizationId: org\.id/);
});
