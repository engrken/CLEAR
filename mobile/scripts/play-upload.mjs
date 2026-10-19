// Uploads a CLEAR AAB to Google Play through the Play Developer API.
// Run from a folder with google-auth-library installed (npm i google-auth-library@9.15.1):
//   PLAY_KEY=<service-account.json> node play-upload.mjs check
//   PLAY_KEY=<service-account.json> node play-upload.mjs upload <file.aab> <notes.txt> [track]
// Set RELEASE_VERSION (e.g. 1.0.2) for the release name.
import fs from 'node:fs';
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
    await call('DELETE', e);
  } else if (cmd === 'upload') {
    const [file, notesFile, track = 'production'] = args;
    const notes = fs.readFileSync(notesFile, 'utf8').trim();
    const details = await call('GET', `${e}/details`);
    const bundle = await call('POST', `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, {
      body: fs.readFileSync(file), headers: { 'Content-Type': 'application/octet-stream' },
    });
    console.log('uploaded versionCode', bundle.versionCode);
    const release = {
      name: `${process.env.RELEASE_VERSION || "1.0.1"} (${bundle.versionCode})`,
      versionCodes: [String(bundle.versionCode)],
      status: 'completed',
      releaseNotes: [{ language: details.defaultLanguage || 'en-US', text: notes }],
    };
    await call('PUT', `${e}/tracks/${track}`, { json: { track, releases: [release] } });
    const done = await call('POST', `${e}:commit`);
    console.log('committed edit', done.id, 'to', track);
  } else {
    await call('DELETE', e);
    console.log('usage: check | upload <aab> <notes> [track]');
  }
} catch (err) {
  await call('DELETE', e).catch(() => {});
  throw err;
}
