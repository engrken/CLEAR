#!/usr/bin/env node
/* CLEAR read-only cutover fingerprint. Operator-only: never log row identifiers.
 * Before: set DATABASE_URL, CLEAR_DB_AUDIT_SCOPE, CLEAR_CUTOVER_AUDIT_KEY;
 * node scripts/finance-cutover-fingerprint.mjs > /secure/before.json
 * After: node scripts/finance-cutover-fingerprint.mjs --compare /secure/before.json
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { MONEY_COLUMNS } from '../lib/financial-column-catalog.mjs';

const scope=process.env.CLEAR_DB_AUDIT_SCOPE||'';
const key=process.env.CLEAR_CUTOVER_AUDIT_KEY||'';
const HMAC = text => createHmac('sha256',key).update(text).digest('hex');
const quote = id => {
  if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) throw Error('Unsafe column');
  return '"' + id + '"';
};
const periodTables = new Set(['Fund','Collection','CollectionSetup','Penalty',
 'CashAdvance','Audit','Collectible','OnlineRemittance','FundTransfer','CashierRemittance']);
const extra = {
 Collection:['orNumber','status','studentId','paymentType'],
 Penalty:['penaltyId','status','studentId'],
 CashierRemittance:['remittanceId','status'],
 VoidTransaction:['transactionType','referenceId'],
 OnlineRemittance:['submissionId','status'],
 ArrearPaymentLink:['receiptId','obligationType','obligationId'],
 PenaltySettlementEvent:['receiptId','penaltyRecordId'],
};

async function fingerprint(tx){
 const groups=[];
 for(const [table,columns] of Object.entries(MONEY_COLUMNS)){
  const hasPeriod=periodTables.has(table),additional=extra[table]||[];
  const selects=['"id"::text AS "rowId"','"organizationId"::text AS "org"',
    hasPeriod?'"academicYear"::text AS "ay"':"''::text AS \"ay\"",
    hasPeriod?'"term"::text AS "periodTerm"':"''::text AS \"periodTerm\""];
  for(const col of columns){
   const c=quote(col);
   selects.push('CASE WHEN '+c+' IS NULL THEN NULL ELSE ROUND('+
    c+'::numeric * 100)::bigint::text END AS '+c);
  }
  for(const col of additional)selects.push(quote(col)+'::text AS '+quote(col));
  // The only SQL identifiers originate in a frozen, audited source catalog.
  const sql='SELECT '+selects.join(', ')+' FROM '+quote(table)+
   ' ORDER BY "organizationId", "ay", "periodTerm", "rowId"';
  const rows=await tx.$queryRawUnsafe(sql);
  if(rows.length>500000)throw Error('Audit dataset exceeds safe batch size');
  let groupName=null,digest=null,sum=null,count=0;
  const flush=()=>{
   if(groupName===null)return;
   groups.push({model:table,group:HMAC('group:'+groupName).slice(0,24),
    count,centavos:sum,digest:digest.digest('hex')});
  };
  for(const row of rows){
   const name=[row.org,row.ay,row.periodTerm].join('\u001f');
   if(groupName!==name){
    flush();
    groupName=name;
    digest=createHmac('sha256',key).update('rows:'+table+':'+name+'\n');
    sum=Object.fromEntries(columns.map(col=>[col,'0']));
    count=0;
   }
   const cents=columns.map(col=>row[col]==null?null:String(row[col]));
   const links=additional.map(col=>row[col]==null?null:String(row[col]));
   digest.update(JSON.stringify([row.rowId,cents,links])+'\n');
   count++;
   for(let j=0;j<columns.length;j++){
    const col=columns[j];
    sum[col]=(BigInt(sum[col])+BigInt(cents[j]??'0')).toString();
   }
  }
  flush();
 }
 return {version:1,groups:groups.sort((a,b)=>a.model.localeCompare(b.model)||
  a.group.localeCompare(b.group))};
}

async function main(){
 if(!['isolated','prod-readonly'].includes(scope)||key.length<32||
    !process.env.DATABASE_URL)throw Error('Missing scope, database or key');
 if(process.argv.length>4||(process.argv[2]&&process.argv[2]!=='--compare')||
   (process.argv[2]==='--compare'&&!process.argv[3]))throw Error('Invalid audit arguments');
 const client=new PrismaClient();
 try{
  const result=await client.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   return fingerprint(tx);
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:60000});
  if(process.argv[2]==='--compare'){
   const old=JSON.parse(readFileSync(process.argv[3],'utf8'));
   if(old?.version!==1||!Array.isArray(old.groups)||
      JSON.stringify(old.groups)!==JSON.stringify(result.groups)){
    throw Error('STOP: financial record fingerprint mismatch');
   }
   process.stdout.write('PASS: all financial record fingerprints equal frozen baseline.\n');
  }else{
   process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }
 }finally{await client.$disconnect();}
}
main().catch(()=>{
 // Never expose raw receipt numbers, student IDs or connection credentials.
 process.stderr.write('STOP: financial fingerprint verification failed.\n');
 process.exitCode=1;
});
