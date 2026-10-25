import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url));
const text = (p) => read(p).toString('utf8');

test('next Android release tracks distinct launcher and adaptive foreground within source tree', () => {
  const config = JSON.parse(text('mobile/app.json')).expo;
  assert.equal(config.icon, './assets/clear-launcher-vnext.png');
  assert.equal(config.android.adaptiveIcon.foregroundImage, './assets/clear-adaptive-foreground-vnext.png');
  assert.equal(config.android.adaptiveIcon.backgroundColor, '#FFFFFF');
  for (const path of [config.icon, config.android.adaptiveIcon.foregroundImage]) {
    const png = read('mobile/' + path.slice(2));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), png.readUInt32BE(20));
    assert.ok(png.readUInt32BE(16) >= 128);
  }
  assert.equal(config.version, '1.2.4');
  assert.equal(config.android.versionCode, 14, 'v1.2.3 code13 already used on Play Internal; verify code14 is unused before upload');
});

test('next signed Play bundle is blocked until original approved full-resolution assets replace preview PNGs', () => {
  const verifier = text('mobile/scripts/verify-live-viewer.mjs');
  assert.match(verifier, /process\.argv\.includes\('--release'\)/);
  assert.match(verifier, /asset\.width, 1024/);
  assert.match(verifier, /createHash\('sha256'\)/);
  assert.match(verifier, /assert\.notEqual\(iconPath, adaptivePath/);
  assert.match(verifier, /PAYMENT_WRITES_ENABLED = false/);
  assert.match(verifier, /MOBILE_BUSINESS_WRITES_ENABLED = false/);
  const guide = text('docs/android-vnext-icon-release.md');
  assert.match(guide, /must not be treated as the final Play artwork/);
  assert.match(guide, /node scripts\/verify-live-viewer\.mjs --release/);
});

test('workstation signed AAB verifier validates official bundletool and retains proper release identity checks', () => {
  const verify = text('mobile/scripts/Verify-ClearAndroidAAB.ps1');
  assert.match(verify, /bundletool-all-1\.18\.3\.jar/);
  assert.match(verify, /expectedToolHash/);
  assert.match(verify, /bundletool validate/);
  assert.match(verify, /jarsigner -verify/);
  assert.match(verify, /signed in JarFile but is not signed in JarInputStream/);
  assert.match(verify, /com\.rupertbulquerin\.clear/);
  assert.match(verify, /'1\.2\.3'/);
  assert.match(verify, /'14'/);
  assert.match(verify, /-lt 36/);
});
