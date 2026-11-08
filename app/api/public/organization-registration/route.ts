import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { academicYearStart, isCalendarMode } from '@/lib/academic-periods';
import { isReservedGlobalAdminEmail } from '@/lib/super-admin';

export const runtime = 'nodejs';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const blocked = new Set(['api','dashboard','department','admin','www','localhost','login','auth','register','pricing']);
function secret() {
 const key=process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
 if (!key || key.length < 32) throw new Error('Verification configuration missing.');
 return key;
}
function hash(id: string, code: string) {
 return crypto.createHmac('sha256',secret()).update('public-freemium:'+id+':'+code).digest('hex');
}
export async function POST(req: NextRequest) {
 if (process.env.PUBLIC_ORG_REGISTRATION_ENABLED !== 'true') return NextResponse.json({error:'Registration is not yet enabled.'},{status:503});
 let input: Record<string,unknown>;
 try { input=await req.json(); } catch { return NextResponse.json({error:'Invalid request.'},{status:400}); }
 const organizationName=String(input.organizationName??'').trim();
 const subdomain=String(input.subdomain??'').trim().toLowerCase();
 const type=String(input.type??'');
 const adminName=String(input.adminName??'').trim();
 const adminEmail=String(input.adminEmail??'').trim().toLowerCase();
 const academicYear=String(input.academicYear??'').trim();
 const calendarMode=String(input.calendarMode??'');
 if (!organizationName || organizationName.length>150 || !slugPattern.test(subdomain) || blocked.has(subdomain) ||
     !['Department','Organization'].includes(type) || !adminName || adminName.length>150 ||
     !emailPattern.test(adminEmail) || adminEmail.length>254 || !isCalendarMode(calendarMode)) {
   return NextResponse.json({error:'Check your organization and administrator details.'},{status:400});
 }
 try { academicYearStart(academicYear); } catch { return NextResponse.json({error:'Use an academic year such as A.Y. 2026 - 2027.'},{status:400}); }
 try {
   if (await isReservedGlobalAdminEmail(adminEmail)) return NextResponse.json({error:'This email cannot register an organization.'},{status:400});
   if (await prisma.organization.findUnique({where:{subdomain},select:{id:true}})) return NextResponse.json({error:'This organization URL is already taken.'},{status:409});
   const now=new Date();
   const existing=await prisma.publicOrganizationRegistration.findUnique({where:{adminEmail}});
   if (existing) {
     if (existing.verifiedAt) return NextResponse.json({error:'This registration has already been verified.'},{status:409});
     if (now.getTime()-existing.lastSentAt.getTime()<60000) return NextResponse.json({error:'Please wait before requesting another code.'},{status:429});
     if (now.getTime()-existing.createdAt.getTime()<86400000 && existing.sendCount>=5) return NextResponse.json({error:'Daily verification request limit reached.'},{status:429});
   }
   const id=existing?.id || crypto.randomUUID();
   const code=crypto.randomInt(100000,1000000).toString();
   const data={organizationName,subdomain,type,adminName,adminEmail,academicYear,calendarMode,
      verificationHash:hash(id,code),expiresAt:new Date(now.getTime()+10*60000),
      lastSentAt:now, attempts:0, verifiedAt:null};
   if (existing) {
     const reset=now.getTime()-existing.createdAt.getTime()>=86400000;
     await prisma.publicOrganizationRegistration.update({where:{id},data:{...data,sendCount:reset?1:existing.sendCount+1,...(reset?{createdAt:now}:{})}});
   } else {
     await prisma.publicOrganizationRegistration.create({data:{id,...data}});
   }
   await sendEmail({to:adminEmail,subject:'Verify your CLEAR Freemium registration',
     text:'Your CLEAR registration verification code is '+code+'. It expires in 10 minutes. Do not share it.',
     html:'<p>Your CLEAR organization verification code is <strong>'+code+'</strong>.</p><p>Expires in 10 minutes. Do not share this code.</p>'});
   return NextResponse.json({id,message:'A verification code has been sent to the administrator email.'});
 } catch (e) {
   console.error('Public registration request failed',e instanceof Error?e.message:'unknown');
   return NextResponse.json({error:'Registration could not be processed. Please try again later.'},{status:503});
 }
}
