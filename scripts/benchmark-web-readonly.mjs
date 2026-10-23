#!/usr/bin/env node
/* Bounded, sequential HTTP latency sampler for authorized CLEAR Preview / localhost.
 * This is NOT a load test. Never use it against Production or include personal data
 * in route labels. Authentication values come from private environment variables.
 *
 * CLEAR_BENCHMARK_BASE_URL=https://verified-preview.vercel.app \
 * CLEAR_BENCHMARK_ROUTES_JSON='{"roster":"/department/test/students","receipts":"/department/test/collections/history"}' \
 * CLEAR_BENCHMARK_SCOPE=preview node scripts/benchmark-web-readonly.mjs
 *
 * Optional: CLEAR_BENCHMARK_COOKIE, CLEAR_BENCHMARK_BYPASS_HEADER
 * Nothing from response bodies, cookies, URLs, or tokens is logged.
 */
import { performance } from 'node:perf_hooks';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw Error('A required Preview benchmark setting is missing.');
  return value;
}
function pct(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] * 10) / 10;
}
async function run() {
  const scope = required('CLEAR_BENCHMARK_SCOPE');
  if (!['preview', 'localhost'].includes(scope)) throw Error('Only Preview/localhost sampling is supported.');
  const base = new URL(required('CLEAR_BENCHMARK_BASE_URL'));
  if (!['http:', 'https:'].includes(base.protocol)) throw Error('Invalid protocol.');
  if (base.username || base.password || base.search || base.hash) throw Error('URL must contain no credentials or query.');
  if (scope === 'localhost' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
    throw Error('The localhost scope requires a loopback host.');
  }
  if (scope === 'preview' && (base.protocol !== 'https:' ||
      !base.hostname.endsWith('.vercel.app') ||
      base.hostname === 'clearsys.vercel.app' ||
      base.hostname.startsWith('clearsys-') === false)) {
    throw Error('Only recognized HTTPS CLEAR Preview hosts are permitted.');
  }
  const routes = JSON.parse(required('CLEAR_BENCHMARK_ROUTES_JSON'));
  if (!routes || Array.isArray(routes) || typeof routes !== 'object') throw Error('Invalid route map.');
  const items = Object.entries(routes);
  if (!items.length || items.length > 5) throw Error('Use 1–5 approved read-only routes.');
  const result = [];
  for (const [label, path] of items) {
    if (!/^[a-z][a-z0-9_-]{0,40}$/.test(label) ||
        typeof path !== 'string' || !path.startsWith('/') ||
        path.startsWith('//') || path.includes('#') || path.includes('?')) {
      throw Error('Route labels and paths must be safe; no student identifiers or query data.');
    }
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw Error('Cross-origin routes are prohibited.');
    const ttfbs=[], totals=[];
    for (let sample=0; sample<7; sample++) {
      const headers={ 'cache-control': 'no-cache', accept: 'text/html,application/json' };
      if (process.env.CLEAR_BENCHMARK_COOKIE) headers.cookie=process.env.CLEAR_BENCHMARK_COOKIE;
      if (process.env.CLEAR_BENCHMARK_BYPASS_HEADER) {
        headers['x-vercel-protection-bypass']=process.env.CLEAR_BENCHMARK_BYPASS_HEADER;
      }
      const start=performance.now();
      const response=await fetch(url, {
        method:'GET',redirect:'manual',cache:'no-store',headers,
        signal:AbortSignal.timeout(15000),
      });
      const ttfb=performance.now()-start;
      if (response.status!==200) {
        await response.body?.cancel();
        throw Error('Expected authorized 200 response. Check Preview identity and permissions.');
      }
      const bytes=await response.arrayBuffer();
      if (bytes.byteLength>8_000_000) throw Error('Response exceeded benchmark safety budget.');
      const total=performance.now()-start;
      if (sample>0) {ttfbs.push(ttfb);totals.push(total);}
    }
    result.push({route:label,samples:6,
      ttfb_ms:{p50:pct(ttfbs,.5),p95:pct(ttfbs,.95)},
      full_transfer_ms:{p50:pct(totals,.5),p95:pct(totals,.95)}});
  }
  process.stdout.write(JSON.stringify({
    scope,note:'Sequential Preview/localhost GET only; not browser rendering, mobile latency or load testing',
    results:result,
  },null,2)+'\n');
}
run().catch(()=>{
  // Do not echo request URLs, cookies, server output or private credentials.
  process.stderr.write('Preview-only read benchmark failed; verify allowed route, authentication and availability.\n');
  process.exitCode=1;
});
