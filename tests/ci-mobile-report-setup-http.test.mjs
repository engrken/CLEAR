// A single disposable-Postgres exercise of authenticated setup & noncash
// report presentation. No Production data or external financial mutations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const expected='postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if(process.env.CI!=='true'||process.env.CLEAR_CI_FINANCE_TEST_ENABLED!=='1'||
   process.env.DATABASE_URL!==expected||process.env.AUTH_URL!=='http://127.0.0.1:3100'){
 throw Error('REFUSING report and setup tests outside disposable CI');
}
const prisma=new PrismaClient();
const host='http://127.0.0.1:3103';
async function account(org,role,allowedTabs) {
 const id=randomUUID();
 const officer=await prisma.tenantUser.create({data:{
  organizationId:org.id,userId:'CI-SET-'+id,username:'ci_setup_'+id,
  email:'ci-set-'+id+'@example.invalid',fullName:'CI Setup Officer',role,
  status:'Active',allowedTabs:JSON.stringify(allowedTabs),
 }});
 const token='clr_'+randomBytes(32).toString('base64url');
 await prisma.mobileSession.create({data:{
  id:randomUUID(),tokenHash:createHash('sha256').update(token).digest('hex'),
  tenantUserId:officer.id,organizationId:org.id,expiresAt:new Date(Date.now()+300000),
 }});
 return token;
}
async function call(org,route,token,body){
 const res=await fetch(host+'/api/mobile/orgs/'+org+'/'+route,{
  method:body?'POST':'GET',
  headers:{...(token?{Authorization:'Bearer '+token}:{}),
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(20000),
 });
 return {status:res.status,body:await res.json()};
}
test('setup is read-only; report branding is versioned/audited without financial effects',
 {timeout:90000},async()=>{
 const uid=randomUUID().slice(0,8),slug='ci-setup-'+uid,foreignSlug=slug+'-other';
 const org=await prisma.organization.create({data:{
  subdomain:slug,name:'CI Setup Original',status:'Active',
  activeAy:'A.Y. 2026 - 2027',activeTerm:'1st Sem',
 }});
 const foreign=await prisma.organization.create({data:{
  subdomain:foreignSlug,name:'CI Other Tenant',status:'Active',
  activeAy:org.activeAy,activeTerm:org.activeTerm,
 }});
 try {
  await prisma.fund.create({data:{
   organizationId:org.id,academicYear:org.activeAy,term:org.activeTerm,
   fundName:'General Fund',initialAllocation:'132.57',
  }});
  await prisma.collectionSetup.create({data:{
   organizationId:org.id,academicYear:org.activeAy,term:org.activeTerm,
   category:'CI Exam',name:'CI Registration',targetFund:'General Fund',
   amount:'21.37',isPackage:false,
  }});
  const admin=await account(org,'Admin',['tab-setup','tab-report']);
  const viewer=await account(org,'viewer',['tab-setup','tab-report']);
  const outsider=await account(foreign,'Admin',['tab-setup','tab-report']);
  assert.equal((await call(slug,'setup-review',null)).status,401);
  assert.equal((await call(slug,'setup-review',outsider)).status,403);
  const setup=await call(slug,'setup-review',viewer);
  assert.equal(setup.status,200,JSON.stringify(setup.body));
  assert.equal(setup.body.scope,'active_period');
  assert.equal(setup.body.funds[0].openingCentavos,13257);
  assert.equal(setup.body.fees[0].amountCentavos,2137);
  const originalFund=await prisma.fund.findFirstOrThrow({where:{organizationId:org.id}});
  const originalFee=await prisma.collectionSetup.findFirstOrThrow({where:{organizationId:org.id}});
  const initial=await call(slug,'report-signatories',admin);
  assert.equal(initial.status,200,JSON.stringify(initial.body));
  assert.match(initial.body.version,/^[a-f0-9]{64}$/);
  assert.equal(initial.body.schoolName,'CI Setup Original');
  const change={expectedVersion:initial.body.version,
   schoolName:'CI Updated Institution',
   schoolAddress:'CI Campus, Cebu',
   records:[{label:'Prepared by:',name:'CI Officer',position:'Treasurer'}],
   confirmation:'SAVE REPORT PRESENTATION'};
  assert.equal((await call(slug,'report-signatories',outsider,change)).status,403);
  assert.equal((await call(slug,'report-signatories',admin,{...change,confirmation:'wrong'})).status,400);
  const saved=await call(slug,'report-signatories',admin,change);
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal(saved.body.success,true);
  assert.equal((await call(slug,'report-signatories',admin,change)).status,409);
  const updated=await call(slug,'report-signatories',viewer);
  assert.equal(updated.status,200);
  assert.equal(updated.body.schoolName,'CI Updated Institution');
  assert.equal(updated.body.schoolAddress,'CI Campus, Cebu');
  assert.deepEqual(updated.body.records,change.records);
  const orgUpdated=await prisma.organization.findUniqueOrThrow({where:{id:org.id}});
  assert.equal(orgUpdated.reportSchoolName,change.schoolName);
  assert.equal(orgUpdated.reportSchoolAddress,change.schoolAddress);
  const fundAfter=await prisma.fund.findUniqueOrThrow({where:{id:originalFund.id}});
  const feeAfter=await prisma.collectionSetup.findUniqueOrThrow({where:{id:originalFee.id}});
  assert.equal(fundAfter.initialAllocation.toString(),originalFund.initialAllocation.toString());
  assert.equal(feeAfter.amount.toString(),originalFee.amount.toString());
  assert.ok(await prisma.systemLog.count({where:{organizationId:org.id,action:'UPDATE_SIGNATORIES'}})>0);
 }finally{
  await prisma.organization.delete({where:{id:org.id}});
  await prisma.organization.delete({where:{id:foreign.id}});
  await prisma.$disconnect();
 }
});
