import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('registration defaults to Freemium via canonical provisioning core',()=>{
 const verify=read('app/api/public/organization-registration/verify/route.ts');
 assert.match(verify,/provisionEntityWithTierCore/);
 assert.match(verify,/tier:'Freemium'/);
 assert.match(verify,/schoolGroup:record.subdomain/);
 assert.match(verify,/timingSafeEqual/);
 assert.match(verify,/attempts:\{lt:5\}/);
});
test('public registration is opt-in and never creates tenant before OTP',()=>{
 const request=read('app/api/public/organization-registration/route.ts');
 const verify=read('app/api/public/organization-registration/verify/route.ts');
 assert.match(request,/PUBLIC_ORG_REGISTRATION_ENABLED/);
 assert.match(verify,/PUBLIC_ORG_REGISTRATION_ENABLED/);
 assert.doesNotMatch(request,/provisionEntityWithTierCore/);
 assert.match(request,/sendEmail/);
});
test('directory and home show registration entry links',()=>{
 assert.match(read('app/page.tsx'),/href="\/register\/organization"/);
 assert.match(read('app/dashboard/page.tsx'),/href="\/register\/organization"/);
});
