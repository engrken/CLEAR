/** Best-effort proxy-reported address for abuse throttling; not an authentication identity. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const last = forwarded?.split(',').map((value) => value.trim()).filter(Boolean).pop();
  return last || headers.get('x-real-ip')?.trim() || 'unknown';
}
