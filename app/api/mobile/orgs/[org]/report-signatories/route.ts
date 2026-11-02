// Noncash financial-report presentation: institution heading and signatories.
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
type Header={schoolName:string;schoolAddress:string};
const digest=(records:Row[],header:Header)=>createHash('sha256').update(JSON.stringify({records,header})).digest('hex');
async function reportHeader(id:string,tx:Pick<Prisma.TransactionClient,'organization'>=prisma):Promise<Header>{
 const org=await tx.organization.findUnique({where:{id},select:{name:true,reportSchoolName:true,reportSchoolAddress:true}});
 if(!org)throw new ApiFailure(404,'not_found','Organization no longer exists.');
 return {schoolName:org.reportSchoolName??org.name,schoolAddress:org.reportSchoolAddress??''};
}
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
 const [records,header]=await Promise.all([rows(org.id),reportHeader(org.id)]);
 return {version:digest(records,header),records,...header};
});
export const POST=handler(async(req,{params}:Ctx)=>{
 const {org:slug}=await params;
 const {org,officer}=await requireMobileOfficer(req,slug,'tab-report');
 if(!canRunMobileReportSignatoryWrites(mobileTenantUserWriteEnvironment()))
   throw new ApiFailure(403,'read_only','Native report presentation editing is not enabled.');
 const body=await readJson<{expectedVersion:string;records:Row[];schoolName:string;schoolAddress:string;confirmation:string}>(req);
 if(typeof body.expectedVersion!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedVersion)||
   body.confirmation!=='SAVE REPORT PRESENTATION'||
   typeof body.schoolName!=='string'||!body.schoolName.trim()||body.schoolName.trim().length>200||
   typeof body.schoolAddress!=='string'||body.schoolAddress.trim().length>300||
   /[\r\n]/.test(body.schoolName)||/[\r\n]/.test(body.schoolAddress)||
   !Array.isArray(body.records)||
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
   // Serialize edits with the organization row so concurrent native
   // presentations cannot silently overwrite one another.
   const orgRow=await tx.organization.findUnique({where:{id:org.id},select:{id:true,status:true}});
   if(orgRow?.status!=='Active')throw new ApiFailure(403,'forbidden','Tenant is not active.');
   const [existing,priorHeader]=await Promise.all([rows(org.id,tx),reportHeader(org.id,tx)]);
   if(digest(existing,priorHeader)!==body.expectedVersion)
     throw new ApiFailure(409,'conflict','Report presentation changed. Refresh before saving.');
   await tx.organization.update({where:{id:org.id},data:{
     reportSchoolName:body.schoolName.trim(),reportSchoolAddress:body.schoolAddress.trim()||null,
   }});
   await tx.signatory.deleteMany({where:{organizationId:org.id}});
   if(sanitized.length)await tx.signatory.createMany({
    data:sanitized.map((row,order)=>({organizationId:org.id,...row,order})),
   });
   await tx.systemLog.create({data:{
    organizationId:org.id,user:officer.email,action:'UPDATE_SIGNATORIES',
    details:'Native report presentation updated, including school name/address and '+sanitized.length+' signatories.',
   }});
   return {success:true};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }catch(err){
  if((err as {code?:string})?.code==='P2034')
    throw new ApiFailure(409,'conflict','Concurrent report presentation change. Refresh.');
  throw err;
 }
});
export const OPTIONS=preflight;
