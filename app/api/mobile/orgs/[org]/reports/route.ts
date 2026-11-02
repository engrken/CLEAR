// Read-only mobile preview of canonical finance activity for the active term.
// Gross recorded allocation lines are NOT official receipt totals.
// Certified reports, signatories and all write actions remain on secure web.
import {prisma} from '@/lib/prisma';
import {ApiFailure, handler, preflight} from '@/lib/mobile/http';
import {requireMobileOfficer} from '@/lib/mobile/session';
import {toCentavos} from '@/lib/mobile/serialize';
type Ctx={params:Promise<{org:string}>};
export const dynamic='force-dynamic';
function exact(value:Parameters<typeof toCentavos>[0]) {
  if(value===null||value===undefined) throw new ApiFailure(422,'financial_data_review','Financial record requires review.');
  try { return toCentavos(value); }
  catch { throw new ApiFailure(422,'financial_data_review','Financial record requires review.'); }
}
export const GET=handler(async(req,{params}:Ctx)=>{
  const {org:slug}=await params;
  const {org}=await requireMobileOfficer(req,slug,['tab-reports','tab-report']);
  const scope={organizationId:org.id, academicYear:org.activeAy, term:org.activeTerm};
  const [allocations,expenses,penalties,advances,assessments]=await Promise.all([
    prisma.collection.aggregate({where:scope,_count:{_all:true},_sum:{amountPaid:true}}),
    prisma.audit.aggregate({where:scope,_count:{_all:true},_sum:{totalExpense:true}}),
    prisma.penalty.aggregate({where:scope,_count:{_all:true},_sum:{fineAmount:true}}),
    prisma.cashAdvance.aggregate({where:scope,_count:{_all:true},_sum:{amountApproved:true}}),
    prisma.collectible.aggregate({where:scope,_count:{_all:true},_sum:{balanceDue:true}}),
  ]);
  const entry=(label:string,count:number,sum:Parameters<typeof toCentavos>[0],meaning:string)=>({
    label, count, amountCentavos: count?exact(sum):0, meaning,
  });
  return {
    scope:'active_period' as const, ay:org.activeAy,term:org.activeTerm,
    generatedAt:new Date().toISOString(),
    reportType:'Unreconciled recorded-activity snapshot. NOT an official financial statement.',
    totals:[
      entry('Collection allocation lines',allocations._count._all,allocations._sum.amountPaid,'Gross recorded line amounts. Some official receipts have multiple allocation rows; voids may be included.'),
      entry('Liquidation records',expenses._count._all,expenses._sum.totalExpense,'Gross recorded expenses; not a cash position.'),
      entry('Penalty assessment records',penalties._count._all,penalties._sum.fineAmount,'Gross recorded remaining penalties; no allowance for reconciliation.'),
      entry('Cash advance records',advances._count._all,advances._sum.amountApproved,'Gross approved principal, not outstanding advances.'),
      entry('Collectible records',assessments._count._all,assessments._sum.balanceDue,'Gross recorded balances; not necessarily collectible cash.'),
    ],
  };
});
export const OPTIONS=preflight;
