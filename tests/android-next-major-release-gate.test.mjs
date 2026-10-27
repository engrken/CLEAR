import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('future Play release preflight must reject already-published version and disallowed native writes',()=>{
 const script=read('mobile/scripts/Preflight-ClearAndroidNextMajor.ps1');
 assert.match(script,/HighestPlayVersionCode/);
 assert.match(script,/-eq '1\.2\.4'/);
 assert.match(script,/\$code -le \$HighestPlayVersionCode/);
 assert.match(script,/com\.rupertbulquerin\.clear/);
 assert.match(script,/PAYMENT_WRITES_ENABLED = false/);
 assert.match(script,/MOBILE_BUSINESS_WRITES_ENABLED = false/);
 assert.match(script,/EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS/);
 assert.doesNotMatch(script,/jarsigner -keystore|gh release create|npm publish|gradlew bundleRelease/);
});
