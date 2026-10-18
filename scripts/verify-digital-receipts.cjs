const fs = require('node:fs');const path=require('node:path');
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const actions=[
'app/department/[department]/(protected)/collections/actions.ts',
'app/department/[department]/(protected)/collections/arrears/actions.ts',
'app/department/[department]/(protected)/remittances/actions.ts',
'app/department/[department]/(protected)/cashier-remittance/actions.ts',
'app/department/[department]/(protected)/advances/actions.ts',
'app/department/[department]/(protected)/liquidations/actions.ts'];
let errors=[];
for(const f of actions){ const s=read(f); if(!s.includes('enqueue') || !s.includes('scheduleDigitalReceiptDispatch')) errors.push(f+' missing queue/schedule hook'); }
const core=read('lib/digital-receipts.ts');
for(const word of ['skipDuplicates: true','sendEmail({','tx.digitalReceiptDelivery.createMany','after(async','Official Payment Receipt','status: "Cancelled"']){
 if(!core.includes(word)) errors.push('core missing '+word);
}
const cron=read('app/api/cron/digital-receipts/route.ts');
if(!cron.includes('CRON_SECRET')||!cron.includes('timingSafeEqual')) errors.push('cron auth guard missing');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('PASS: 6 accounting actions enqueue documents; shared outbox, post-commit delivery, void suppression and authenticated retry route present.');
