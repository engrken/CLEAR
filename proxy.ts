import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  let subdomain = '';

  // Local development only:
  // engineering.localhost:3000
  if (hostname.includes('localhost')) {
    const hostWithoutPort = hostname.split(':')[0];
    const parts = hostWithoutPort.split('.');

    if (
      parts.length > 1 &&
      parts[0] !== 'localhost' &&
      parts[0] !== 'www'
    ) {
      subdomain = parts[0];
    }
  }

  // Rewrite local department subdomains
  if (subdomain) {
    return NextResponse.rewrite(
      new URL(
        `/department/${subdomain}${url.pathname}${url.search}`,
        request.url
      )
    );
  }

  // Normal Vercel/production requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};