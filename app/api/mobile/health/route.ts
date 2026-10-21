// Preview-only, read-only CLEAR Android diagnostics.
// No bearer tokens, credentials, personal records, counts, or database hosts
// are returned. This route must not appear on Production main.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });

export async function GET() {
  // A preview commit deployed to the wrong branch/environment must fail closed.
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'android-parity-integration'
  ) {
    return response({ error: 'not_found' }, 404);
  }

  try {
    // Verifies actual PostgreSQL connectivity and that the isolated
    // global-mobile-session migration exists, without reading account data.
    await prisma.globalMobileSession.findFirst({
      select: { id: true },
      take: 1,
    });
    return response({
      service: 'CLEAR Android Preview',
      status: 'ready',
      deployment: 'preview',
      branch: 'android-parity-integration',
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'unknown',
      database: 'reachable',
      globalSessionSchema: 'ready',
    });
  } catch (err) {
    // Never print connection strings, database hosts, or query details publicly.
    console.error('[mobile-preview-health] private database readiness check failed');
    return response({
      service: 'CLEAR Android Preview',
      status: 'unavailable',
      database: 'unavailable',
    }, 503);
  }
}
