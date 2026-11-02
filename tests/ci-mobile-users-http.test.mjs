// Authenticated non-cash account management tests on a disposable CI database ONLY.
// No Neon/Production URL, no real student, officer or financial records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const expectedDb = 'postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' ||
    process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== expectedDb ||
    process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw Error('REFUSING officer-status HTTP tests outside the disposable CI database.');
}
const prisma = new PrismaClient();
const base = 'http://127.0.0.1:3103';
const orgSlug = 'ci-users-' + randomUUID().slice(0,8);

async function createAccount(org, role, allowedTabs, options = {}) {
  const suffix = randomUUID();
  const account = await prisma.tenantUser.create({ data: {
    organizationId: org.id, userId: 'CI-USERS-' + suffix,
    fullName: options.fullName || 'Synthetic Officer ' + suffix.slice(0,5),
    username: 'ci_u_' + suffix,
    email: options.email || 'ci-u-' + suffix + '@example.invalid',
    role, status: 'Active', allowedTabs: JSON.stringify(allowedTabs),
  } });
  const token = 'clr_' + randomBytes(32).toString('base64url');
  const session = await prisma.mobileSession.create({ data: {
    id: randomUUID(), tokenHash: createHash('sha256').update(token).digest('hex'),
    tenantUserId: account.id, organizationId: org.id,
    expiresAt: new Date(Date.now()+600_000),
  } });
  return { account, token, session };
}
async function request(slug, method, token, body, search = '') {
  const url = base + '/api/mobile/orgs/' + slug + '/users' + search;
  const res = await fetch(url, {
    method, headers: { ...(token?{Authorization:'Bearer '+token}:{}),
      ...(body?{'Content-Type':'application/json'}:{}) },
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20_000),
  });
  return { status:res.status, body:await res.json() };
}

async function manage(slug, token, body) {
  const res = await fetch(base + '/api/mobile/orgs/' + slug + '/users/manage', {
    method:'POST',
    headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body:JSON.stringify(body), signal:AbortSignal.timeout(20_000),
  });
  return { status:res.status, body:await res.json() };
}

test('real non-cash officer status HTTP: permission, tenant isolation, opt-in and financial non-mutation', {timeout:120_000}, async () => {
  const org = await prisma.organization.create({ data: {
    subdomain:orgSlug, name:'CI Officer Management Tenant', status:'Active',
    activeAy:'A.Y. CI 2026 - 2027',activeTerm:'1st Sem',
  } });
  const foreign = await prisma.organization.create({ data: {
    subdomain:orgSlug+'-foreign',name:'CI Foreign Officer Tenant',status:'Active',
    activeAy:'A.Y. CI 2026 - 2027',activeTerm:'1st Sem',
  } });
  try {
    const actor=await createAccount(org,'Admin',['tab-users'],{fullName:'CI Acting Admin'});
    const otherAdmin=await createAccount(org,'administrator',['tab-users'],{fullName:'CI Other Admin'});
    const standard=await createAccount(org,'Officer',['tab-users'],{fullName:'CI Non-Admin'});
    const member=await createAccount(org,'viewer',['tab-overview'],{fullName:'CI Viewer'});
    const outsider=await createAccount(foreign,'Admin',['tab-users'],{fullName:'CI Foreign Admin'});
    const protectedUser=await createAccount(org,'viewer',['tab-overview'],{
      fullName:'CI Protected Global Email',email:'ci-super-admin@example.invalid',
    });
    const snapshot = async () => ({
      collection:await prisma.collection.count({where:{organizationId:org.id}}),
      penalty:await prisma.penalty.count({where:{organizationId:org.id}}),
      audit:await prisma.audit.count({where:{organizationId:org.id}}),
      users:await prisma.tenantUser.count({where:{organizationId:org.id}}),
    });
    const before=await snapshot();
    assert.equal((await request(orgSlug,'GET',null)).status,401);
    assert.equal((await request(orgSlug,'GET',standard.token)).status,403);
    assert.equal((await request(orgSlug,'GET',member.token)).status,403);
    assert.equal((await request(orgSlug,'GET',outsider.token)).status,403);
    const granted=await request(orgSlug,'GET',actor.token);
    assert.equal(granted.status,200,JSON.stringify(granted.body));
    assert.ok(granted.body.records.some(r=>r.id===actor.account.id));
    assert.ok(granted.body.records.some(r=>r.id===otherAdmin.account.id));
    assert.ok(!granted.body.records.some(r=>r.id===outsider.account.id));
    assert.ok(granted.body.records.every(r=>r.otpCode === undefined && r.tokenHash === undefined));
    const filtered=await request(orgSlug,'GET',actor.token,undefined,'?q=Other%20Admin');
    assert.equal(filtered.status,200);
    assert.deepEqual(filtered.body.records.map(x=>x.id),[otherAdmin.account.id]);
    const original=granted.body.records.find(r=>r.id===otherAdmin.account.id);
    assert.ok(original.updatedAt);
    const command=(id,status,expectedUpdatedAt)=>({id,status,expectedUpdatedAt});
    assert.equal((await request(orgSlug,'POST',standard.token,command(otherAdmin.account.id,'Blocked',original.updatedAt))).status,403);
    assert.equal((await request(orgSlug,'POST',outsider.token,command(otherAdmin.account.id,'Blocked',original.updatedAt))).status,403);
    assert.equal((await request(orgSlug,'POST',actor.token,command(outsider.account.id,'Blocked',original.updatedAt))).status,404);
    assert.equal((await request(orgSlug,'POST',actor.token,command(actor.account.id,'Inactive',actor.account.updatedAt.toISOString()))).status,403);
    assert.equal((await request(orgSlug,'POST',actor.token,command(protectedUser.account.id,'Inactive',protectedUser.account.updatedAt.toISOString()))).status,403);
    assert.equal((await request(orgSlug,'POST',actor.token,command(otherAdmin.account.id,'Disabled',original.updatedAt))).status,400);
    assert.equal((await request(orgSlug,'POST',actor.token,command(otherAdmin.account.id,'Inactive','2020-01-01T00:00:00.000Z'))).status,409);
    const loggedBefore=await prisma.systemLog.count({where:{organizationId:org.id}});
    const changed=await request(orgSlug,'POST',actor.token,command(otherAdmin.account.id,'Blocked',original.updatedAt));
    assert.equal(changed.status,200,JSON.stringify(changed.body));
    assert.equal(changed.body.success,true);
    assert.equal((await prisma.tenantUser.findUnique({where:{id:otherAdmin.account.id}})).status,'Blocked');
    assert.equal((await prisma.mobileSession.findUnique({where:{id:otherAdmin.session.id}})).revokedAt !== null,true);
    assert.equal((await request(orgSlug,'GET',otherAdmin.token)).status,401);
    assert.equal(await prisma.systemLog.count({where:{organizationId:org.id}}),loggedBefore+1);
    assert.equal((await request(orgSlug,'POST',actor.token,command(otherAdmin.account.id,'Inactive',original.updatedAt))).status,409);
    assert.deepEqual(await snapshot(),before,'Changing an officer status must not touch accounting or roster totals');
    // Role editing and creation use a separate, opt-in, non-financial path.
    assert.deepEqual(Object.keys(granted.body.rolePresets).sort(), ['admin','auditor','treasurer','viewer']);
    const create = {
      action:'create', fullName:'CI Native New Officer', username:'native_officer_ci',
      email:'native-new-officer@example.invalid', role:'treasurer', status:'Active',
      allowedTabs:['tab-remittances','tab-clearance'],
    };
    assert.equal((await manage(orgSlug,standard.token,create)).status,403);
    assert.equal((await manage(orgSlug,outsider.token,create)).status,403);
    assert.equal((await manage(orgSlug,actor.token,{...create,allowedTabs:['tab-unknown']})).status,400);
    assert.equal((await manage(orgSlug,actor.token,{...create,email:'ci-super-admin@example.invalid'})).status,403);
    const created=await manage(orgSlug,actor.token,create);
    assert.equal(created.status,200,JSON.stringify(created.body));
    assert.equal(created.body.success,true);
    assert.ok(created.body.id);
    assert.equal((await manage(orgSlug,actor.token,create)).status,409,
      'Duplicate officer email/username must fail');
    const fresh=await prisma.tenantUser.findFirstOrThrow({
      where:{id:created.body.id,organizationId:org.id},
    });
    assert.equal(fresh.role,'treasurer');
    assert.deepEqual(JSON.parse(fresh.allowedTabs),create.allowedTabs);
    assert.equal((await manage(orgSlug,actor.token,{
      ...create,action:'update',id:outsider.account.id,expectedUpdatedAt:fresh.updatedAt.toISOString(),
    })).status,404,'Cross-tenant target rejected');
    assert.equal((await manage(orgSlug,actor.token,{
      ...create,action:'update',id:protectedUser.account.id,
      expectedUpdatedAt:protectedUser.account.updatedAt.toISOString(),
    })).status,403,'Protected Global Administrator cannot be modified');
    assert.equal((await manage(orgSlug,actor.token,{
      ...create,action:'update',id:actor.account.id,
      expectedUpdatedAt:actor.account.updatedAt.toISOString(),
    })).status,403,'Self role/identity changes prohibited');
    assert.equal((await manage(orgSlug,actor.token,{
      ...create,action:'update',id:standard.account.id,
      expectedUpdatedAt:'2020-01-01T00:00:00.000Z',
    })).status,409,'Stale mobile edit rejected');
    const edit = await manage(orgSlug,actor.token,{
      action:'update',id:standard.account.id,
      expectedUpdatedAt:standard.account.updatedAt.toISOString(),
      fullName:standard.account.fullName,
      username:standard.account.username,
      email:standard.account.email,role:'auditor',status:'Active',
      allowedTabs:['tab-audit','tab-reports'],
    });
    assert.equal(edit.status,200,JSON.stringify(edit.body));
    const edited=await prisma.tenantUser.findUniqueOrThrow({where:{id:standard.account.id}});
    assert.equal(edited.role,'auditor');
    assert.deepEqual(JSON.parse(edited.allowedTabs),['tab-audit','tab-reports']);
    assert.ok((await prisma.mobileSession.findUniqueOrThrow({where:{id:standard.session.id}})).revokedAt,
      'Role edit must revoke existing mobile session');
    assert.equal((await request(orgSlug,'GET',standard.token)).status,401);
    assert.equal((await manage(orgSlug,actor.token,{
      action:'update',id:standard.account.id,
      expectedUpdatedAt:standard.account.updatedAt.toISOString(),
      fullName:standard.account.fullName,
      username:standard.account.username,
      email:standard.account.email,role:'viewer',status:'Active',allowedTabs:[],
    })).status,409,'Old version cannot overwrite a newer permission edit');
    const final=await snapshot();
    assert.equal(final.users,before.users+1);
    assert.equal(final.collection,before.collection);
    assert.equal(final.penalty,before.penalty);
    assert.equal(final.audit,before.audit);

  } finally {
    await prisma.organization.delete({where:{id:org.id}});
    await prisma.organization.delete({where:{id:foreign.id}});
    await prisma.$disconnect();
  }
});
