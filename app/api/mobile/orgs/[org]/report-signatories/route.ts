// Financial-report presentation only: signatory labels/names/positions.
// This is the same tenant table used by the web Report Submission/Settings.
// Independent default-off mobile grant, serializable optimistic replacement,
// and audit, with NO edits to recorded/financial transactions.
import {createHash} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {prisma} from '@/lib/prisma';
import {ApiFailure,handler,preflight,readJson} from '@/lib/mobile/http';
import {requireMobileOfficer} from '@/lib/mobile/session';
import {canRunMobileReportSignatoryWrites,mobileTenantUserWriteEnvironment} from '@/lib/mobile/production-readonly';
type Ctx={params:Promise<{org:string}>};
type Row={label:string;name:string;position:string};
export const dynamic='force-dynamic';
const digest=(rows:Row[])=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
async function rows(org:string,tx:Pick<Prisma.TransactionClient,'signatory'>=prisma){
 const list=await tx.signatory.findMany({where:{organizationId:org},
   orderBy:[{order:'asc'},{id:'asc'}],
   select:{label:true,name:true,position:true},take:21});
 if(list.length>20)throw new ApiFailure(409,'conflict','Too many report signatories for mobile editing. Use secure web.');
 return list.map(({label,name,position})=>({label,name,position}));
}
export const GET=handler(async(req,{params}:Ctx)=>{
 const {org:slug}=await params;
 const {org}=await requireMobileOfficer(req,slug,'tab-report');
 const records=await rows(org.id);
 return {version:digest(records),records};
});
export const POST=handler(async(req,{params}:Ctx)=>{
 const {org:slug}=await params;
 const {org,officer}=await requireMobileOfficer(req,slug,'tab-report');
 if(!canRunMobileReportSignatoryWrites(mobileTenantUserWriteEnvironment()))
   throw new ApiFailure(403,'read_only','Native report presentation editing is not enabled.');
 const body=await readJson<{expectedVersion:string;records:Row[];confirmation:string}>(req);
 if(typeof body.expectedVersion!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedVersion)||
   body.confirmation!=='SAVE SIGNATORIES'||!Array.isArray(body.records)||
   body.records.length>20||body.records.some(row=>!row||typeof row!=='object'||
      typeof row.label!=='string'||typeof row.name!=='string'||typeof row.position!=='string'||
      row.label.length>100||row.name.length>120||row.position.length>120||
      /[\r\n]/.test(row.label)||/[\r\n]/.test(row.name)||/[\r\n]/.test(row.position)))
   throw new ApiFailure(400,'invalid','Report signatories or confirmation are invalid.');
 const sanitized=body.records.map(row=>({
   label:row.label.trim(),name:row.name.trim(),position:row.position.trim(),
 })).filter(row=>row.label||row.name||row.position);
 try{
  return await prisma.$transaction(async tx=>{
   const existing=await rows(org.id,tx);
   if(digest(existing)!==body.expectedVersion)
     throw new ApiFailure(409,'conflict','Report signatories changed. Refresh before saving.');
   await tx.signatory.deleteMany({where:{organizationId:org.id}});
   if(sanitized.length)await tx.signatory.createMany({
    data:sanitized.map((row,order)=>({organizationId:org.id,...row,order})),
   });
   await tx.systemLog.create({data:{
    organizationId:org.id,user:officer.email,action:'UPDATE_SIGNATORIES',
    details:'Native report signatories updated: '+sanitized.length+' entries.',
   }});
   return {success:true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }catch(err){
  if((err as {code?:string})?.code==='P2034')
    throw new ApiFailure(409,'conflict','Concurrent report signatory change. Refresh.');
  throw err;
 }
});
export const OPTIONS=preflight;
