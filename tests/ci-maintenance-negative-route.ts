// CI-only unauthenticated POST probe into real Global Administrator action.
import { NextResponse } from 'next/server';
import { setMaintenancePolicy } from '@/app/dashboard/provisions/maintenance/actions';
export async function POST() {
  if (process.env.CLEAR_CI_FINANCE_TEST_ENABLED !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const data = new FormData();
  data.set('scope','global');
  data.set('mode','FULL');
  data.set('confirmation','APPLY MAINTENANCE');
  data.set('reason','CI unauthenticated attempt must never activate maintenance');
  data.set('expiresAt','2026-11-01T10:00');
  try {
    await setMaintenancePolicy(data);
    return NextResponse.json({ error: 'security_guard_failed' }, { status: 500 });
  } catch {
    return NextResponse.json({ denied: true }, {
      status: 403, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
