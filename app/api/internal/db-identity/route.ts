import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const deny = () => NextResponse.json({ status: 'not_found' }, {
  status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' },
});

function same(a: string, b: string) {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * One-time deployment diagnostic. Requires a separately provisioned
 * CLEAR_PRODUCTION_DB_VERIFY_TOKEN and an expected Neon endpoint identifier
 * supplied as an explicit query parameter. Never logs or returns DB_URL,
 * hostname, username, credentials, branch metadata or student information.
 *
 * DO NOT enable by default. Remove this route after successful verification.
 */
export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production' || process.env.CLEAR_PRODUCTION_DB_VERIFY_ENABLED !== 'true') {
    return deny();
  }
  const expectedToken = process.env.CLEAR_PRODUCTION_DB_VERIFY_TOKEN || '';
  const authorization = request.headers.get('authorization') || '';
  if (expectedToken.length < 32 || !authorization.startsWith('Bearer ') ||
      !same(authorization.slice(7), expectedToken)) return deny();

  const expected = request.nextUrl.searchParams.get('endpoint') || '';
  if (!/^ep-[a-z0-9-]{8,64}$/.test(expected)) return deny();

  try {
    const url = new URL(process.env.DATABASE_URL || '');
    const actualEndpoint = url.hostname.split('.')[0].replace(/-pooler$/, '');
    const endpointMatches = same(actualEndpoint, expected);
    if (!endpointMatches) {
      return NextResponse.json({ status: 'mismatch', endpointMatches: false }, {
        status: 409, headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    // The query verifies the actual connection, database, and newly migrated
    // table. No personal/financial records are accessed or returned.
    await prisma.globalMobileSession.count({ where: { id: '__clear_diag_never_exists__' } });
    return NextResponse.json({ status: 'verified', endpointMatches: true, schemaReady: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    console.error('[clear-db-identity] diagnostic failed (details intentionally redacted)');
    return NextResponse.json({ status: 'unavailable' }, {
      status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
