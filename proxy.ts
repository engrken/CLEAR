// Next.js 16 proxy: financial cutover maintenance gate and localhost tenant rewrite.
// Authorization remains enforced independently in server routes and actions.
// Old deployment URLs must also be isolated during maintenance.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { maintenanceForTenant } from '@/lib/maintenance/service';
import { isRecoveryPath, requestDecision, tenantFromLocation } from '@/lib/maintenance/rules';

export async function proxy(request: NextRequest) {
  // Hard maintenance gate for the synchronized money-type cutover. Applies to
  // all HTTP methods and all previously authenticated web, student and mobile
  // routes, not only to new logins. The deployment must be verified first.
  if (process.env.CLEAR_MAINTENANCE_MODE === 'locked') {
    const pathname = request.nextUrl.pathname;
    if (pathname === '/maintenance' && request.method === 'GET') {
      return NextResponse.next();
    }
    const headers = { 'Cache-Control': 'no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' };
    if (pathname.startsWith('/api/') || request.method !== 'GET') {
      return NextResponse.json(
        { error: 'CLEAR is temporarily unavailable for scheduled maintenance.' },
        { status: 503, headers },
      );
    }
    const maintenanceUrl = request.nextUrl.clone();
    maintenanceUrl.pathname = '/maintenance';
    maintenanceUrl.search = '';
    return NextResponse.redirect(maintenanceUrl, { status: 307, headers });
  }

  // P3 operational maintenance layers ON TOP OF (never replacing) the
  // emergency CLEAR_MAINTENANCE_MODE=locked financial-cutover switch.
  // Both web Server Action POSTs and direct API requests must obey it.
  const scopedPath = request.nextUrl.pathname;
  if (!isRecoveryPath(scopedPath)) {
    try {
      const tenant = tenantFromLocation(scopedPath, request.nextUrl.hostname);
      const policy = await maintenanceForTenant(tenant);
      const decision = requestDecision(policy.mode, request.method, scopedPath);
      if (decision !== 'ALLOW') {
        const maintenanceHeaders = {
          'Cache-Control': 'private, no-store, max-age=0',
          'Retry-After': '60', 'X-Clear-Maintenance': policy.mode,
          'X-Robots-Tag': 'noindex, nofollow',
        };
        if (decision === 'READ_ONLY_BLOCK' || scopedPath.startsWith('/api/')) {
          return NextResponse.json({
            error: { code: 'maintenance', message: 'CLEAR is temporarily unavailable for this operation.' },
          }, { status: 503, headers: maintenanceHeaders });
        }
        const page = request.nextUrl.clone();
        page.pathname = '/maintenance';
        page.search = '';
        return NextResponse.redirect(page, { status: 307, headers: maintenanceHeaders });
      }
    } catch {
      // A policy lookup failure must never authorize a financial mutation.
      return NextResponse.json({
        error: { code: 'maintenance_state_unavailable',
          message: 'CLEAR maintenance status cannot be verified. Please try again later.' },
      }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
    }
  }

  const hostname = request.nextUrl.hostname.toLowerCase();
  // Keep the existing "engineering.localhost" workflow without trusting arbitrary hostnames.
  const match = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.localhost$/.exec(hostname);
  if (!match || match[1] === 'www') return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  // Avoid double-prefixing, and don't rewrite framework or API URLs.
  if (pathname.startsWith('/department/') || pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }
  const destination = request.nextUrl.clone();
  destination.pathname = `/department/${match[1]}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(destination);
}

export const config = {
  // API and server-action requests must NOT bypass the maintenance gate.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
