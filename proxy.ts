import { NextResponse, type NextRequest } from 'next/server';
import { maintenanceForTenant } from '@/lib/maintenance/service';
import { isRecoveryPath, requestDecision, tenantSlugFromPath } from '@/lib/maintenance/rules';

// Node.js Proxy enforces maintenance for web Server Action POSTs AND mobile/API
// direct requests. Middleware-only UI banners do not provide these safeguards.
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isRecoveryPath(path)) return NextResponse.next();
  try {
    const policy = await maintenanceForTenant(tenantSlugFromPath(path));
    const verdict = requestDecision(policy.mode, req.method, path);
    if (verdict === 'ALLOW') return NextResponse.next();

    const headers = { 'Cache-Control': 'private, no-store, max-age=0',
      'Retry-After': '60', 'X-Clear-Maintenance': policy.mode };
    if (verdict === 'READ_ONLY_BLOCK' || path.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'maintenance',
        message: 'CLEAR is temporarily unavailable for this operation. Please try again later.' } },
        { status: 503, headers });
    }
    // Next router can render a safe generic status view for non-API GETs.
    const response = NextResponse.rewrite(new URL('/maintenance', req.url));
    Object.entries(headers).forEach(([k,v]) => response.headers.set(k,v));
    return response;
  } catch {
    // Unlike an unconfigured mode, a database/connectivity fault cannot
    // silently re-enable financial writes when status cannot be verified.
    return NextResponse.json({ error: { code: 'maintenance_state_unavailable',
      message: 'CLEAR maintenance status cannot be verified. Please try again later.' } },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
}

export const config = { matcher: [
  '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?)$).*)',
] };
