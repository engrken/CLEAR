// Uploads a CLEAR AAB (and optionally new phone screenshots) to Google Play through the Play Developer API.
// Run from a folder with google-auth-library installed (npm i google-auth-library@9.15.1):
//   PLAY_KEY=<service-account.json> node play-upload.mjs check
//   PLAY_KEY=<service-account.json> RELEASE_VERSION=1.1.0 node play-upload.mjs upload <file.aab> <notes.txt> [track] [screenshotsDir]
// With screenshotsDir, the default listing's phone screenshots are replaced by the PNGs in it
// (sorted by name) in the same edit, so the store page and the release change together.
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';

const PKG = 'com.rupertbulquerin.clear';
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}`;

const auth = new GoogleAuth({ keyFile: process.env.PLAY_KEY, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const client = await auth.getClient();

async function call(method, url, { json, body, headers } = {}) {
  const res = await client.request({
    method, url, headers, data: json ?? body, validateStatus: () => true,
    ...(body ? { maxBodyLength: Infinity, maxContentLength: Infinity } : {}),
  });
  if (res.status >= 300) throw new Error(`${method} ${url.replace(API, '').replace(UPLOAD, '')} → ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
}

const [cmd, ...args] = process.argv.slice(2);
const edit = await call('POST', `${API}/edits`, { json: {} });
const e = `${API}/edits/${edit.id}`;
try {
  if (cmd === 'check') {
    const details = await call('GET', `${e}/details`);
    console.log('default language:', details.defaultLanguage);
    const { tracks = [] } = await call('GET', `${e}/tracks`);
    for (const t of tracks) {
      for (const r of t.releases || []) console.log(`${t.track}: ${r.name || '-'} codes=${(r.versionCodes || []).join(',')} status=${r.status}`);
    }
    const lang = details.defaultLanguage || 'en-US';
    const { images = [] } = await call('GET', `${e}/listings/${lang}/phoneScreenshots`);
    console.log(`phone screenshots (${lang}): ${images.length}`);
    await call('DELETE', e);
  } else if (cmd === 'upload') {
    const [file, notesFile, track = 'production', shotsDir] = args;
    const notes = fs.readFileSync(notesFile, 'utf8').trim();
    const details = await call('GET', `${e}/details`);
    const lang = details.defaultLanguage || 'en-US';
    const bundle = await call('POST', `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, {
      body: fs.readFileSync(file), headers: { 'Content-Type': 'application/octet-stream' },
    });
    console.log('uploaded versionCode', bundle.versionCode);
    const release = {
      name: `${process.env.RELEASE_VERSION || 'release'} (${bundle.versionCode})`,
      versionCodes: [String(bundle.versionCode)],
      status: 'completed',
      releaseNotes: [{ language: lang, text: notes }],
    };
    await call('PUT', `${e}/tracks/${track}`, { json: { track, releases: [release] } });
    if (shotsDir) {
      const shots = fs.readdirSync(shotsDir).filter((f) => /\.png$/i.test(f)).sort();
      if (shots.length < 2 || shots.length > 8) throw new Error(`Play needs 2-8 phone screenshots, found ${shots.length}`);
      await call('DELETE', `${e}/listings/${lang}/phoneScreenshots`);
      for (const f of shots) {
        await call('POST', `${UPLOAD}/edits/${edit.id}/listings/${lang}/phoneScreenshots?uploadType=media`, {
          body: fs.readFileSync(path.join(shotsDir, f)), headers: { 'Content-Type': 'image/png' },
        });
        console.log('screenshot', f);
      }
    }
    const done = await call('POST', `${e}:commit`);
    console.log('committed edit', done.id, 'to', track);
  } else {
    await call('DELETE', e);
    console.log('usage: check | upload <aab> <notes> [track] [screenshotsDir]');
  }
} catch (err) {
  await call('DELETE', e).catch(() => {});
  throw err;
}
