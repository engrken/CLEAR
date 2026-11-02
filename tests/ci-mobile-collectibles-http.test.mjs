// Authenticated GET-only collectible review against an isolated CI PostgreSQL.
// All records, accounts and tokens are synthetic. Never run against Neon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db='postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if (process.env.CI !== 'true' || process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1' ||
    process.env.DATABASE_URL !== db || process.env.AUTH_URL !== 'http://127.0.0.1:3100') {
  throw new Error('REFUSING collectibles read test outside disposable CI database');
}
const prisma=new PrismaClient();
const api='http://127.0.0.1:3100/api/mobile/orgs/';
async function account(org,role,tabs) {
  const id=randomUUID();
  const user=await prisma.tenantUser.create({data:{
    organizationId:org.id,userId:'CI-COL-'+id,fullName:'CI Collectibles Officer',
    username:'ci_col_'+id,email:'ci_col_'+id+'@example.invalid',
    role,status:'Active',allowedTabs:JSON.stringify(tabs),
  }});
  const token='clr_'+randomBytes(32).toString('base64url');
  await prisma.mobileSession.create({data:{
    id:randomUUID(),tokenHash:createHash('sha256').update(token).digest('hex'),
    organizationId:org.id,tenantUserId:user.id,expiresAt:new Date(Date.now()+300000),
  }});
  return token;
}
async function call(slug,token,query='') {
  const res=await fetch(api+slug+'/collectibles'+query,{
    headers:token?{Authorization:'Bearer '+token}:{},
    signal:AbortSignal.timeout(15000),
  });
  return {status:res.status,body:await res.json()};
}
test('authenticated collectible pagination preserves exact money and hides identity markers', {timeout:60000}, async()=>{
  const slug='ci-collectibles-'+randomUUID().slice(0,8);
  const org=await prisma.organization.create({data:{
    subdomain:slug,name:'CI Collectibles',status:'Active',
    activeAy:'A.Y. CI 2026 - 2027',activeTerm:'1st Sem',
  }});
  const other=await prisma.organization.create({data:{
    subdomain:slug+'-foreign',name:'CI Foreign Collectibles',status:'Active',
    activeAy:'A.Y. CI 2026 - 2027',activeTerm:'1st Sem',
  }});
  try {
    const admin=await account(org,'admin',[]);
    const unauthorized=await account(org,'Officer',['tab-overview']);
    const foreign=await account(other,'admin',[]);
    const amounts=['12.34','100.01','0.05'];
    for (let i=0;i<amounts.length;i++) {
      await prisma.collectible.create({data:{
        organizationId:org.id,category:'CI Activity '+i,headcount:i+1,
        balanceDue:amounts[i],academicYear:org.activeAy,term:org.activeTerm,
        status:'Outstanding|SID:2026-private|ITEM:Sensitive',
      }});
    }
    await prisma.collectible.create({data:{
      organizationId:org.id,category:'CI Previous Term',balanceDue:'75.00',
      academicYear:org.activeAy,term:'2nd Sem',
    }});
    const before=await prisma.collectible.findMany({
      where:{organizationId:org.id},select:{id:true,balanceDue:true,status:true},
      orderBy:{id:'desc'},
    });
    assert.equal((await call(slug,null)).status,401);
    assert.equal((await call(slug,unauthorized)).status,403);
    assert.equal((await call(slug,foreign)).status,403);
    assert.equal((await call(slug,admin,'?limit=0')).status,400);
    const p1=await call(slug,admin,'?limit=2');
    assert.equal(p1.status,200,JSON.stringify(p1.body));
    assert.equal(p1.body.scope,'active_period');
    assert.equal(p1.body.records.length,2);
    assert.equal(p1.body.hasMore,true);
    assert.ok(p1.body.nextCursor);
    assert.ok(p1.body.records.every(r => r.status === 'Outstanding'));
    assert.ok(p1.body.records.every(r => !JSON.stringify(r).includes('private')));
    const p2=await call(slug,admin,'?limit=2&cursor='+encodeURIComponent(p1.body.nextCursor));
    assert.equal(p2.status,200,JSON.stringify(p2.body));
    assert.equal(p2.body.records.length,1);
    assert.equal(p2.body.hasMore,false);
    const all=[...p1.body.records,...p2.body.records];
    assert.equal(new Set(all.map(r=>r.id)).size,3);
    assert.deepEqual(all.map(r=>r.balanceCentavos).sort((a,b)=>a-b),[5,1234,10001]);
    const cursor=JSON.parse(Buffer.from(p1.body.nextCursor,'base64url').toString('utf8'));
    const altered=Buffer.from(JSON.stringify({...cursor,org:other.id})).toString('base64url');
    assert.equal((await call(slug,admin,'?cursor='+encodeURIComponent(altered))).status,400);
    const after=await prisma.collectible.findMany({
      where:{organizationId:org.id},select:{id:true,balanceDue:true,status:true},
      orderBy:{id:'desc'},
    });
    assert.deepEqual(after,before,'Reading collectibles must not mutate monetary records');
  } finally {
    await prisma.organization.delete({where:{id:org.id}});
    await prisma.organization.delete({where:{id:other.id}});
    await prisma.$disconnect();
  }
});
