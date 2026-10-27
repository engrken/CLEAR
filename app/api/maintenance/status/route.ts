// Stage 1: a truthful public status for the existing emergency environment lock.
// IMPORTANT: This does not advertise/enable a database toggle or scheduled
// announcements until audited policy storage and server enforcement ship.
import { emergencyEnvironmentMode } from '@/lib/maintenance-policy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mode = emergencyEnvironmentMode(process.env.CLEAR_MAINTENANCE_MODE);
  return Response.json({
    mode,
    reason: mode === 'full' ? 'CLEAR is temporarily unavailable for scheduled maintenance.' : '',
    effectiveUntil: null,
    lastChangedAt: null,
  }, { status: 200, headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Type': 'application/json; charset=utf-8',
  } });
}
