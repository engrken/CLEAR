// Global administrator-only notice scheduling and maintenance recovery.
// This is not a tenant-officer management action, and is not a cash write.
// Web's audit model and scheduling constraints remain the source of truth.
import {prisma} from '@/lib/prisma';
import {ApiFailure,handler,preflight,readJson} from '@/lib/mobile/http';
import {requireGlobalMobileAdmin} from '@/lib/mobile/global-session';
import {validMode} from '@/lib/maintenance/rules';
import {canRunMobileGlobalMaintenanceWrites,mobileTenantUserWriteEnvironment} from '@/lib/mobile/production-readonly';
export const dynamic='force-dynamic';
function datePht(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw new ApiFailure(400,'invalid','Specify time YYYY-MM-DDTHH:mm in PHT.');
 const dt=new Date(value+':00+08:00');
 if(!Number.isFinite(dt.getTime())||new Date(dt.getTime()+8*3600000).toISOString().slice(0,16)!==value)
   throw new ApiFailure(400,'invalid','Invalid Manila date or time.');
 return dt;
}
function summary(row:{scopeKey:string;mode:string;title:string;message:string;startsAt:Date;endsAt:Date;state:string;version:number}){
 return {scopeKey:row.scopeKey,mode:row.mode,title:row.title,message:row.message,
  startsAt:row.startsAt.toISOString(),endsAt:row.endsAt.toISOString(),state:row.state,version:row.version};
}
export const GET=handler(async(req)=>{
 await requireGlobalMobileAdmin(req);
 const now=new Date();
 const rows=await prisma.maintenanceNotice.findMany({
   where:{state:{in:['DRAFT','SCHEDULED']},endsAt:{gt:now}},
   orderBy:[{startsAt:'asc'},{createdAt:'desc'}],take:100,
   select:{id:true,scopeKey:true,mode:true,title:true,message:true,startsAt:true,endsAt:true,state:true,version:true},
 });
 return {serverTime:now.toISOString(),notices:rows.map(row=>({...summary(row),id:row.id}))};
});
type Payload={
 action:'create'|'cancel'|'end_early';scope?:string;mode?:string;
 title?:string;message?:string;startsAt?:string;endsAt?:string;
 id?:string;expectedVersion?:number;confirmation?:string;
};
export const POST=handler(async(req)=>{
 const {identity}=await requireGlobalMobileAdmin(req);
 if(!canRunMobileGlobalMaintenanceWrites(mobileTenantUserWriteEnvironment())) {
   throw new ApiFailure(403,'read_only','Mobile maintenance changes are not enabled. Use secure web recovery.');
 }
 const body=await readJson<Payload>(req);
 const now=new Date();
 if(body.action==='create'){
   const scope=typeof body.scope==='string'?body.scope.trim().toLowerCase():'';
   const key=scope==='global'?'GLOBAL':
     /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(scope)?'tenant:'+scope:'';
   if(!key)throw new ApiFailure(400,'invalid','Choose Global or a valid tenant.');
   if(key!=='GLOBAL'&&!await prisma.organization.findUnique({
     where:{subdomain:scope},select:{id:true},
   }))throw new ApiFailure(404,'not_found','The selected tenant does not exist.');
   const mode=typeof body.mode==='string'?body.mode:'';
   if(!validMode(mode))throw new ApiFailure(400,'invalid','Invalid maintenance mode.');
   const title=typeof body.title==='string'?body.title.trim():'';
   const message=typeof body.message==='string'?body.message.trim():'';
   if(title.length<5||title.length>140||message.length<10||message.length>800)
     throw new ApiFailure(400,'invalid','Notice title and message are required within the size limits.');
   const start=datePht(body.startsAt),end=datePht(body.endsAt);
   const maxDays=mode==='NORMAL'?14:7;
   if(end<=start||end.getTime()<=now.getTime()||end.getTime()-start.getTime()>maxDays*86400000||
     (mode!=='NORMAL'&&start.getTime()<now.getTime()-120000))
       throw new ApiFailure(400,'invalid','Invalid notice window or maintenance start/expiry.');
   const confirm=mode==='NORMAL'?'SCHEDULE NOTICE':'SCHEDULE MAINTENANCE';
   if(body.confirmation!==confirm)throw new ApiFailure(400,'confirmation_required','Confirm the exact scheduling action.');
   await prisma.$transaction(async(tx)=>{
     const row=await tx.maintenanceNotice.create({data:{
       scopeKey:key,title,message,mode,startsAt:start,endsAt:end,
       state:'SCHEDULED',createdBy:identity.email,updatedBy:identity.email,
     }});
     await tx.maintenanceAudit.create({data:{
       scopeKey:key,action:'NOTICE_CREATE',actor:identity.email,after:summary(row),
     }});
   });
   return {success:true};
 }
 if(body.action!=='cancel'&&body.action!=='end_early')throw new ApiFailure(400,'invalid','Unknown maintenance action.');
 const action=body.action==='end_early'?'END_EARLY':'CANCEL';
 if(body.confirmation!==action)throw new ApiFailure(400,'confirmation_required','Confirm exact maintenance action.');
 if(typeof body.id!=='string'||body.id.length<1||body.id.length>128||
   !Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1)
     throw new ApiFailure(400,'invalid','Refresh notice and retry.');
 return prisma.$transaction(async(tx)=>{
   const before=await tx.maintenanceNotice.findUnique({where:{id:body.id}});
   if(!before||before.state!=='SCHEDULED')
     throw new ApiFailure(409,'conflict','Notice is unavailable or no longer active.');
   const active=before.startsAt<=now&&before.endsAt>now;
   if(body.action==='end_early'&&(!active||before.mode==='NORMAL'))
     throw new ApiFailure(409,'conflict','Only an active maintenance restriction can end early.');
   if(body.action==='cancel'&&active&&before.mode!=='NORMAL')
     throw new ApiFailure(409,'conflict','Use End early for active maintenance.');
   const result=await tx.maintenanceNotice.updateMany({
     where:{id:before.id,version:body.expectedVersion},
     data:{state:'CANCELLED',version:{increment:1},updatedBy:identity.email},
   });
   if(result.count!==1)throw new ApiFailure(409,'conflict','Notice changed. Refresh and retry.');
   const after=await tx.maintenanceNotice.findUniqueOrThrow({where:{id:before.id}});
   await tx.maintenanceAudit.create({data:{
     scopeKey:before.scopeKey,action:'NOTICE_'+action,actor:identity.email,
     before:summary(before),after:summary(after),
   }});
   return {success:true};
 });
});
export const OPTIONS=preflight;
