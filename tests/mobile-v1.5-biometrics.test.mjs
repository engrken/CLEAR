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
 for(const x of ["lock.key === key ? lock.status : 'checking'","effectiveLock !== 'open'","setLock({ key, status: 'checking' })","AppState.addEventListener","unlockWithBiometrics(identity)"]) assert.ok(s.includes(x),x);
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
 for (const marker of ['lockEpoch.current', "setLock({ key, status: 'locked' })", "AppState.currentState === 'active'", 'epoch === lockEpoch.current']) {
  assert.ok(s.includes(marker), marker);
 }
 assert.ok(!s.includes('unlockWithBiometrics(identity!)'), 'unlock must guard missing identity');
});

test('biometric unlock requires opt-in for the active identity and device support', () => {
 const source = read('mobile/src/lib/biometrics.ts');
 assert.match(source, /export async function biometricEnabled[\s\S]*?biometricAvailable\(\)/);
 assert.match(source, /export async function unlockWithBiometrics[\s\S]*?biometricEnabled\(identity\)/);
});

test('OS biometric prompt transitions do not invalidate the foreground unlock epoch', () => {
  const root = read('mobile/src/app/_layout.tsx');
  assert.match(root, /const biometricPromptActive = useRef\(false\)/);
  assert.match(root, /!biometricPromptActive\.current/);
  assert.match(root, /biometricPromptActive\.current = true/);
  assert.match(root, /biometricPromptActive\.current = false/);
  assert.match(root, /verified && AppState\.currentState === 'active'/);
  assert.match(root, /if \(!identity \|\| biometricPromptActive\.current\) return/);
});
test('the actual APK and AAB enable the same secure biometrics and production-only user scope', () => {
  const eas = JSON.parse(read('mobile/eas.json'));
  const app = JSON.parse(read('mobile/app.json'));
  const cfg = read('mobile/src/api/config.ts');
  assert.ok(app.expo.plugins.includes('expo-secure-store'));
  for (const name of ['v15-uat', 'production']) {
    const profile = eas.build[name];
    assert.equal(profile.env.EXPO_PUBLIC_API_URL, 'https://clearsys.vercel.app/api/mobile');
    assert.equal(profile.env.EXPO_PUBLIC_CLEAR_STUDENT_ROSTER_WRITES, 'true');
    assert.equal(profile.env.EXPO_PUBLIC_CLEAR_TENANT_OPERATIONS, 'false');
  }
  assert.match(cfg, /releaseKind === 'v15-production-uat' \|\| releaseKind === 'v15-production'/);
  assert.equal(eas.build['v15-uat'].android.buildType, 'apk');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
});
