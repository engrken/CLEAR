// Authorized fund movement history. Financial transfers are NEVER writable
// on Android; this route does not compute net position or change period state.
import {prisma} from '@/lib/prisma';
import {ApiFailure, handler, preflight} from '@/lib/mobile/http';
import {requireMobileOfficer} from '@/lib/mobile/session';
import {toCentavos} from '@/lib/mobile/serialize';
type Ctx={params:Promise<{org:string}>};
type Cursor={v:1;org:string;ay:string;term:string;at:string;id:string};
export const dynamic='force-dynamic';
const stamp=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const identifier=/^[A-Za-z0-9_-]{1,120}$/;
function parseCursor(raw:string|null,org:string,ay:string,term:string):Cursor|null{
  if(raw===null)return null;
  if(raw.length<8||raw.length>1200||!/^[A-Za-z0-9_-]+$/.test(raw))throw new ApiFailure(400,'invalid_cursor','Refresh this history.');
  try{
    const cursor=JSON.parse(Buffer.from(raw,'base64url').toString('utf8')) as Partial<Cursor>;
    if(Buffer.from(JSON.stringify(cursor)).toString('base64url')!==raw||cursor.v!==1||cursor.org!==org||
      cursor.ay!==ay||cursor.term!==term||typeof cursor.at!=='string'||!stamp.test(cursor.at)||
      !Number.isFinite(Date.parse(cursor.at))||new Date(cursor.at).toISOString()!==cursor.at||
      typeof cursor.id!=='string'||!identifier.test(cursor.id))throw Error('Invalid cursor');
    return cursor as Cursor;
  }catch{throw new ApiFailure(400,'invalid_cursor','Refresh this history.');}
}
export const GET=handler(async(req,{params}:Ctx)=>{
  const {org:slug}=await params;
  const {org}=await requireMobileOfficer(req,slug,'tab-transfer');
  const q=new URL(req.url).searchParams;
  const raw=q.get('limit')??'25';
  if(!/^[1-9]\d*$/.test(raw)||Number(raw)>40)throw new ApiFailure(400,'invalid','Limit must be 1–40.');
  const limit=Number(raw);
  const scope={organizationId:org.id,academicYear:org.activeAy,term:org.activeTerm};
  const cursor=parseCursor(q.get('cursor'),org.id,org.activeAy,org.activeTerm);
  const rows=await prisma.fundTransfer.findMany({
    where:cursor?{...scope,OR:[
      {timestamp:{lt:new Date(cursor.at)}},
      {timestamp:new Date(cursor.at),id:{lt:cursor.id}},
    ]}:scope,
    select:{id:true,timestamp:true,sourceFund:true,destinationFund:true,amount:true,reason:true,encodedBy:true},
    orderBy:[{timestamp:'desc'},{id:'desc'}],take:limit+1,
  });
  const page=rows.slice(0,limit),last=page[page.length-1],hasMore=rows.length>limit;
  return {
    scope:'active_period' as const,ay:org.activeAy,term:org.activeTerm,hasMore,
    nextCursor:hasMore&&last?Buffer.from(JSON.stringify({
      v:1,org:org.id,ay:org.activeAy,term:org.activeTerm,at:last.timestamp.toISOString(),id:last.id,
    } satisfies Cursor)).toString('base64url'):null,
    entries:page.map(row=>{
      let amountCentavos:number;
      try{amountCentavos=toCentavos(row.amount);}
      catch{throw new ApiFailure(422,'financial_data_review','A transfer amount needs review.');}
      // Older rollover reasons can embed financial metadata that belongs only
      // on the web reconciliation screen. Never echo this encoded internal data.
      const reason=row.reason.split('[[CLEAR_ROLLOVER_V2:')[0].trim();
      return {id:row.id,when:row.timestamp.toISOString(),from:row.sourceFund,
        to:row.destinationFund,amountCentavos,reason:reason.slice(0,250),
        encodedBy:row.encodedBy??null};
    }),
  };
});
export const OPTIONS=preflight;
