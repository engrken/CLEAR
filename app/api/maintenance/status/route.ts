import { NextResponse, type NextRequest } from 'next/server';
import { maintenancePublicState } from '@/lib/maintenance/service';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tenant');
  const slug = raw?.trim().toLowerCase() || null;
  if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ error: { code: 'invalid', message: 'Invalid tenant.' } },
      { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    return NextResponse.json(await maintenancePublicState(slug), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ mode: 'UNKNOWN', reason: 'Maintenance status unavailable.',
      notices: [], error: { code: 'maintenance_state_unavailable' } },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
}
