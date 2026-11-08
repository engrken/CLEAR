import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { provisionEntityWithTierCore } from '@/lib/provisioning/core';
import { isCalendarMode } from '@/lib/academic-periods';

export const runtime='nodejs';
function secret() {
 const key=process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
 if (!key || key.length<32) throw new Error('Verification configuration missing.');
 return key;
}
function digest(id:string,code:string) {
 return crypto.createHmac('sha256',secret()).update('public-freemium:'+id+':'+code).digest('hex');
}
export async function POST(req:NextRequest) {
 if (process.env.PUBLIC_ORG_REGISTRATION_ENABLED!=='true') return NextResponse.json({error:'Registration is not enabled.'},{status:503});
 let id='',code='';
 try {
   const body=await req.json();
   id=String(body.id??'');code=String(body.code??'');
 } catch {return NextResponse.json({error:'Invalid request.'},{status:400});}
 if (!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9]{6}$/.test(code)) return NextResponse.json({error:'Invalid verification code.'},{status:400});
 try {
   // Count every attempt atomically; hard limit prevents guessing short codes.
   const admission=await prisma.publicOrganizationRegistration.updateMany({
     where:{id,verifiedAt:null,expiresAt:{gt:new Date()},attempts:{lt:5}},
     data:{attempts:{increment:1}}
   });
   if(admission.count!==1) return NextResponse.json({error:'Code expired or verification attempts exhausted. Request a new code.'},{status:400});
   const record=await prisma.publicOrganizationRegistration.findUnique({where:{id}});
   if(!record || !isCalendarMode(record.calendarMode)) return NextResponse.json({error:'Invalid registration.'},{status:400});
   const expected=Buffer.from(record.verificationHash,'hex');
   const actual=Buffer.from(digest(id,code),'hex');
   if(expected.length!==actual.length || !crypto.timingSafeEqual(expected,actual)) return NextResponse.json({error:'Invalid verification code.'},{status:400});
   const lockTime=new Date();
   const claimed=await prisma.publicOrganizationRegistration.updateMany({
      where:{id,verifiedAt:null,expiresAt:{gt:new Date()}},
      data:{verifiedAt:lockTime}
   });
   if(claimed.count!==1) return NextResponse.json({error:'Registration already being processed.'},{status:409});
   try {
     const created=await provisionEntityWithTierCore('PUBLIC_VERIFIED_REGISTRATION', {
       name:record.organizationName,subdomain:record.subdomain,
       schoolGroup:record.subdomain,tier:'Freemium',type:record.type,
       adminName:record.adminName,adminEmail:record.adminEmail,
       initialAcademicYear:record.academicYear,calendarMode:record.calendarMode,
       includeSummer:false
     });
     return NextResponse.json({success:true,department:created.department,message:'Your Freemium workspace is ready.'});
   } catch(error) {
     await prisma.publicOrganizationRegistration.updateMany({where:{id,verifiedAt:lockTime},data:{verifiedAt:null}});
     console.error('Public Freemium provisioning failed',error instanceof Error?error.message:'unknown');
     return NextResponse.json({error:'Workspace creation could not complete. Please retry, or contact support.'},{status:409});
   }
 }catch(error){
   console.error('Public registration verification failed',error instanceof Error?error.message:'unknown');
   return NextResponse.json({error:'Verification is temporarily unavailable.'},{status:503});
 }
}
