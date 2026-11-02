// Authenticated, synthetic-only academic calendar integration. No Production DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const expected='postgresql://clear_ci:clear_ci@127.0.0.1:5432/clear_ci?schema=public';
if(process.env.CI!=='true'||process.env.CLEAR_CI_FINANCE_TEST_ENABLED!=='1'||
   process.env.DATABASE_URL!==expected||process.env.AUTH_URL!=='http://127.0.0.1:3100'){
  throw Error('REFUSING academic calendar tests outside disposable CI database');
}
const prisma=new PrismaClient();
const base='http://127.0.0.1:3103';
async function account(org,role,tabs){
  const key=randomUUID();
  const user=await prisma.tenantUser.create({data:{
    organizationId:org.id,userId:'CI-CAL-'+key,fullName:'CI Calendar Officer',
    username:'ci_cal_'+key,email:'ci-cal-'+key+'@example.invalid',
    role,status:'Active',allowedTabs:JSON.stringify(tabs),
  }});
  const token='clr_'+randomBytes(32).toString('base64url');
  await prisma.mobileSession.create({data:{
    id:randomUUID(),tokenHash:createHash('sha256').update(token).digest('hex'),
    tenantUserId:user.id,organizationId:org.id,expiresAt:new Date(Date.now()+300000),
  }});
  return token;
}
async function req(slug,method,token,payload){
  const response=await fetch(base+'/api/mobile/orgs/'+slug+'/academic-calendar',{
    method,headers:{...(token?{Authorization:'Bearer '+token}:{}),
      ...(payload?{'Content-Type':'application/json'}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{}),
    signal:AbortSignal.timeout(15000),
  });
  return {status:response.status,body:await response.json()};
}
test('academic calendar cannot strand financial history and honors tenant/version/admin', {timeout:90000},async()=>{
  const id=randomUUID().slice(0,8);
  const slug='ci-calendar-'+id;
  const org=await prisma.organization.create({data:{
    subdomain:slug,name:'CI Academic Calendar',status:'Active',
    activeAy:'A.Y. 2026 - 2027',activeTerm:'1st Sem',
  }});
  const foreign=await prisma.organization.create({data:{
    subdomain:slug+'-foreign',name:'CI Foreign Calendar',status:'Active',
    activeAy:'A.Y. 2026 - 2027',activeTerm:'1st Sem',
  }});
  try{
    const admin=await account(org,'Admin',['tab-setup']);
    const viewer=await account(org,'viewer',['tab-setup']);
    const outsider=await account(foreign,'Admin',['tab-setup']);
    const future='A.Y. 2027 - 2028';
    const create={academicYear:future,mode:'Semester',includeSummer:true,expectedUpdatedAt:null};
    assert.equal((await req(slug,'GET',null)).status,401);
    assert.equal((await req(slug,'POST',viewer,create)).status,403);
    assert.equal((await req(slug,'POST',outsider,create)).status,403);
    assert.equal((await req(slug,'POST',admin,{...create,mode:'Unknown'})).status,400);
    assert.equal((await req(slug,'POST',admin,{...create,academicYear:org.activeAy,mode:'FullYear'})).status,409,
      'Active 1st Sem cannot silently be moved to Full Year');
    const saved=await req(slug,'POST',admin,create);
    assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.equal(saved.body.success,true);
    let listed=await req(slug,'GET',admin);
    assert.equal(listed.status,200,JSON.stringify(listed.body));
    const current=listed.body.configurations.find(row=>row.academicYear===future);
    assert.equal(current.mode,'Semester');
    assert.ok(current.updatedAt);
    assert.equal((await req(slug,'POST',admin,create)).status,409,'stale create conflict');
    const updated=await req(slug,'POST',admin,{...create,mode:'Trimester',includeSummer:true,
      expectedUpdatedAt:current.updatedAt});
    assert.equal(updated.status,200,JSON.stringify(updated.body));
    const config=await prisma.academicPeriodConfig.findUniqueOrThrow({
      where:{organizationId_academicYear:{organizationId:org.id,academicYear:future}},
    });
    assert.equal(config.mode,'Trimester');
    assert.equal(config.includeSummer,false);
    await prisma.collectible.create({data:{
      organizationId:org.id,category:'CI Future Obligation',
      academicYear:future,term:'1st Trimester',balanceDue:'21.37',
    }});
    const before=await prisma.collectible.findMany({
      where:{organizationId:org.id},select:{id:true,balanceDue:true,term:true},
    });
    assert.equal((await req(slug,'POST',admin,{...create,mode:'FullYear',includeSummer:false,
      expectedUpdatedAt:config.updatedAt.toISOString()})).status,409);
    const after=await prisma.collectible.findMany({
      where:{organizationId:org.id},select:{id:true,balanceDue:true,term:true},
    });
    assert.deepEqual(after,before,'Calendar must never adjust financial balances');
    assert.equal((await prisma.organization.findUniqueOrThrow({
      where:{id:org.id},select:{activeTerm:true},
    })).activeTerm,'1st Sem');
    assert.ok(await prisma.systemLog.count({where:{organizationId:org.id,action:'ACADEMIC_CALENDAR_UPDATE'}})>=2);
  }finally{
    await prisma.organization.delete({where:{id:org.id}});
    await prisma.organization.delete({where:{id:foreign.id}});
    await prisma.$disconnect();
  }
});
