// Public proof submissions are disabled on the Android integration branch until
// the canonical web remittance validation and rate-limiting service is reused.
// Never accept a financial submission through an unreviewed duplicate path.
import { ApiFailure, handler, preflight } from '@/lib/mobile/http';

export const POST = handler(async () => {
  throw new ApiFailure(503, 'temporarily_unavailable', 'Mobile proof submissions are temporarily unavailable. Use the CLEAR web portal.');
});

export const OPTIONS = preflight;
