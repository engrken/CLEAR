import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeTelemetryEvent } from '../lib/telemetry-privacy.ts';

test('redacts tenant, student and financial identifiers, URL queries and fragments', () => {
  const entry = { url: 'https://clearsys.vercel.app/department/jiecep/collections/history?or=26-556&studentId=PRIV-ID&token=PRIVATE#secret',
    route: '/department/jiecep/collections/history', metric: 'LCP' };
  const actual = sanitizeTelemetryEvent(entry);
  assert.deepEqual(actual, { url: 'https://clearsys.vercel.app/department/[tenant]/collections/history', route: '/department/[tenant]/collections/history', metric: 'LCP' });
  assert.equal(entry.url.includes('PRIV-ID'), true, 'do not mutate caller-owned events');
  assert.doesNotMatch(JSON.stringify(actual), /jiecep|26-556|PRIV-ID|PRIVATE|secret/);
});

test('student OTP inquiry has a generic route, never an account or email', () => {
  assert.deepEqual(sanitizeTelemetryEvent({url:'https://clearsys.vercel.app/department/tenant123/clearance?email=secret%40example.com'}), {
    url: 'https://clearsys.vercel.app/department/[tenant]/clearance', route: '/department/[tenant]/clearance'
  });
});

test('public QR certificate verification and arbitrary APIs are never tracked', () => {
  for (const url of [
    'https://clearsys.vercel.app/clearance/verify?token=v3.SECRET',
    'https://clearsys.vercel.app/api/mobile/orgs/tenant/clearance',
    'ftp://clearsys.vercel.app/path',
    'not a URL',
  ]) assert.equal(sanitizeTelemetryEvent({ url }), null);
});

test('unknown sensitive paths and admin provisioning URLs are generalized', () => {
  assert.deepEqual(sanitizeTelemetryEvent({url:'https://clearsys.vercel.app/users/student-secret/payment/OR-123'}),{
    url:'https://clearsys.vercel.app/other',route:'/other'
  });
  assert.deepEqual(sanitizeTelemetryEvent({url:'https://clearsys.vercel.app/dashboard/provisions/administrators?invite=abcdef'}),{
    url:'https://clearsys.vercel.app/dashboard/provisions',route:'/dashboard/provisions'
  });
});

test('root layout runs both SDKs through single client-only privacy guard', () => {
  const root=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
  const widget=readFileSync(new URL('../components/PrivacySafeTelemetry.tsx',import.meta.url),'utf8');
  assert.match(root, /<PrivacySafeTelemetry \/>/);
  assert.doesNotMatch(root, /<Analytics \/>/);
  assert.match(widget, /'use client'/);
  assert.match(widget, /<Analytics beforeSend=\{sanitizeTelemetryEvent\}/);
  assert.match(widget, /<SpeedInsights beforeSend=\{sanitizeTelemetryEvent\} sampleRate=\{0\.5\}/);
});
