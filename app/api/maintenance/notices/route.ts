import { NextResponse, type NextRequest } from 'next/server';
import { maintenancePublicState } from '@/lib/maintenance/service';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const tenant = req.nextUrl.searchParams.get('tenant');
    if (tenant && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant)) {
      return NextResponse.json({ error: { code: 'invalid', message: 'Invalid tenant.' } }, { status: 400 });
    }
    const value = await maintenancePublicState(tenant);
    return NextResponse.json({ notices: value.notices, serverTime: value.serverTime },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: { code: 'maintenance_state_unavailable' } }, { status: 503 });
  }
}
