// Copied to two endpoints ONLY inside disposable CircleCI before Next build.
// /api/auth/ci-maintenance-bench bypasses P3 proxy lookup (recovery route).
// /api/ci-maintenance-bench traverses the normal P3 proxy lookup.
// Both execute exactly this same constant-time handler.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, name: 'maintenance-ci-benchmark' }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
