// Next.js 16 proxy: development subdomain rewrite only.
// Authorization belongs to server pages and server actions, not this rewrite.
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
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
  matcher: ['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
