import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
test('biometric secret is stored in Keystore/Keychain with authentication required', () => {
 const s=read('mobile/src/lib/biometrics.ts');
 for(const x of ['canUseBiometricAuthentication()', 'requireAuthentication: true', 'authenticationPrompt:', 'SecureStore.getItemAsync', 'confirmed !== proof', 'scope(identity)']) assert.ok(s.includes(x),x);
 assert.ok(!s.includes('setItem(PROOF'), 'proof must not use unprotected generic storage');
});
test('app gates protected routes on biometric unlock and background transition',()=>{
 const s=read('mobile/src/app/_layout.tsx');
 for(const x of ["lock !== 'open'","setLock('checking')","AppState.addEventListener","unlockWithBiometrics(identity)"]) assert.ok(s.includes(x),x);
});
test('both account roles offer opt-in and sign-out clears enrollment',()=>{
 assert.ok(read('mobile/src/app/officer/profile.tsx').includes('<BiometricSettings'));
 assert.ok(read('mobile/src/app/global/account.tsx').includes('<BiometricSettings'));
 assert.ok(read('mobile/src/lib/session.tsx').includes('await disableBiometrics()'));
});
test('biometric integration uses existing native dependency and preserves lockfile',()=>{
 const p=JSON.parse(read('mobile/package.json'));
 assert.ok(p.dependencies['expo-secure-store']);
 assert.ok(!p.dependencies['expo-local-authentication']);
});

test('background transitions invalidate pending unlocks and fail closed', () => {
 const s = read('mobile/src/app/_layout.tsx');
 for (const marker of ['lockEpoch.current', "setLock('locked')", "AppState.currentState === 'active'", 'epoch === lockEpoch.current']) {
  assert.ok(s.includes(marker), marker);
 }
 assert.ok(!s.includes('unlockWithBiometrics(identity!)'), 'unlock must guard missing identity');
});
