import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  let subdomain = '';

  // Extract subdomain for local development (e.g., engineering.localhost:3000)
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[0] !== 'localhost') {
      subdomain = parts[0];
    }
  } else {
    // Production wildcard subdomain support (e.g., engineering.yourdomain.com)
    const parts = hostname.split('.');
    if (parts.length > 2) {
      subdomain = parts[0];
    }
  }

  // If a valid department subdomain is present, rewrite the request
  if (subdomain && subdomain !== 'www') {
    return NextResponse.rewrite(
      new URL(`/department/${subdomain}${url.pathname}${url.search}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except API routes, static assets, and favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};