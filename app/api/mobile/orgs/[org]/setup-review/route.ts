// Current-period fee and opening-fund configuration, read-only on Android.
// This is an informational setup view, NOT a live cash balance.
import {prisma} from '@/lib/prisma';
import {ApiFailure,handler,preflight} from '@/lib/mobile/http';
import {requireMobileOfficer} from '@/lib/mobile/session';
import {toCentavos} from '@/lib/mobile/serialize';
type Ctx={params:Promise<{org:string}>};
export const dynamic='force-dynamic';
function cents(v:Parameters<typeof toCentavos>[0]):number{
 try{return toCentavos(v);}catch{throw new ApiFailure(422,'financial_data_review','Setup amount requires a web review.');}
}
export const GET=handler(async(req,{params}:Ctx)=>{
 const {org:slug}=await params;
 const {org}=await requireMobileOfficer(req,slug,'tab-setup');
 const scope={organizationId:org.id,academicYear:org.activeAy,term:org.activeTerm};
 const [funds,fees,fundCount,feeCount,calendar]=await Promise.all([
  prisma.fund.findMany({where:scope,select:{id:true,fundName:true,initialAllocation:true},
    orderBy:{fundName:'asc'},take:101}),
  prisma.collectionSetup.findMany({where:scope,select:{
    id:true,category:true,name:true,amount:true,targetFund:true,isPackage:true,
  },orderBy:[{category:'asc'},{name:'asc'},{id:'asc'}],take:101}),
  prisma.fund.count({where:scope}),
  prisma.collectionSetup.count({where:scope}),
  prisma.academicPeriodConfig.findUnique({
    where:{organizationId_academicYear:{organizationId:org.id,academicYear:org.activeAy}},
    select:{mode:true,includeSummer:true},
  }),
 ]);
 return {scope:'active_period' as const,ay:org.activeAy,term:org.activeTerm,
  calendar:calendar?{mode:calendar.mode,includeSummer:calendar.includeSummer}:null,
  fundsTotal:fundCount,feesTotal:feeCount,
  funds:funds.slice(0,100).map(f=>({id:f.id,name:f.fundName,openingCentavos:cents(f.initialAllocation)})),
  fees:fees.slice(0,100).map(f=>({
    id:f.id,category:f.category,name:f.name,amountCentavos:cents(f.amount),
    targetFund:f.targetFund,isPackage:f.isPackage,
  })),
  // No available balance or cash position calculated from the configuration table.
 };
});
export const OPTIONS=preflight;
