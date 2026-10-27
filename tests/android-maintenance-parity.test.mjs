import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseServiceStatus, serviceAdvisoryKey, serviceStatusUrl } from '../mobile/src/lib/maintenance-status.ts';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base = {mode:'NORMAL',reason:'',effectiveUntil:null,lastChangedAt:null,notices:[]};
const notice = {id:'n1',title:'Scheduled repairs',message:'Service window',startsAt:'2026-11-10T10:00:00Z',endsAt:'2026-11-10T12:00:00Z',revision:1,state:'UPCOMING'};
test('public status matches web NORMAL, READ_ONLY and FULL with no invented default',()=>{
  for(const mode of ['NORMAL','READ_ONLY','FULL']) assert.equal(parseServiceStatus({...base,mode})?.mode,mode);
  assert.equal(parseServiceStatus({...base,mode:'UNKNOWN'}),null);
  assert.equal(parseServiceStatus({...base,notices:null}),null);
  assert.equal(parseServiceStatus({...base,reason:'x\nprivate'}),null);
});
test('notices are bounded, tenant-aware, and revision changes force redisplay',()=>{
 const a=parseServiceStatus({...base,notices:[notice]});
 const b=parseServiceStatus({...base,notices:[{...notice,revision:2}]});
 assert.ok(a&&b);assert.notEqual(serviceAdvisoryKey(a,'jiecep'),serviceAdvisoryKey(b,'jiecep'));
 assert.notEqual(serviceAdvisoryKey(a,'jiecep'),serviceAdvisoryKey(a,'fcusr'));
 assert.equal(serviceAdvisoryKey(parseServiceStatus(base),'jiecep'),'');
 assert.equal(parseServiceStatus({...base,notices:Array(13).fill(notice)}),null);
});
test('request reads only first-party HTTPS production status with explicit tenant',()=>{
 assert.equal(serviceStatusUrl('https://clearsys.vercel.app/api/mobile','jiecep'),
 'https://clearsys.vercel.app/api/maintenance/status?tenant=jiecep');
 assert.throws(()=>serviceStatusUrl('http://localhost:3000/api/mobile',null));
 assert.throws(()=>serviceStatusUrl('https://clearsys.vercel.app/api/mobile','../private'));
});
test('root checks startup, foreground and every 45 seconds with no native policy override',()=>{
 const root=read('mobile/src/app/_layout.tsx');
 const noticeUi=read('mobile/src/components/maintenance/ServiceAdvisory.tsx');
 const config=read('mobile/src/api/config.ts');
 assert.match(root,/<ServiceAdvisory/);
 assert.match(noticeUi,/45_000/);
 assert.match(noticeUi,/AppState\.addEventListener/);
 assert.match(noticeUi,/parseServiceStatus/);
 assert.match(noticeUi,/timeZone: 'Asia\/Manila'/);
 assert.match(config,/PAYMENT_WRITES_ENABLED = false/);
 assert.match(config,/MOBILE_BUSINESS_WRITES_ENABLED = false/);
 assert.doesNotMatch(noticeUi,/setItem|AsyncStorage|SecureStore/);
});
