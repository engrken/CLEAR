/** Browser handoff URL validation. No bearer token or OTP may be used as a browser credential. */
const WEB_ORIGIN = 'https://clearsys.vercel.app';

export function validateWebHandoffUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid web handoff URL.');
  const url = new URL(value);
  if (url.origin !== WEB_ORIGIN || url.username || url.password || url.hash ||
      url.pathname !== '/auth/mobile-handoff' || url.searchParams.size !== 1) {
    throw new Error('Untrusted web handoff destination.');
  }
  const ticket = url.searchParams.get('ticket');
  if (!ticket || !/^[A-Za-z0-9_-]{43,128}$/.test(ticket)) {
    throw new Error('Invalid web handoff ticket.');
  }
  return url.toString();
}
