// /lib/request-ip.ts
//
// The client's IP as recorded by OUR proxy. Apache (VPS) appends the address it
// saw to X-Forwarded-For and Vercel overwrites the header, so the LAST entry is
// the trustworthy one; earlier entries can be forged by the client.

export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').map((s) => s.trim()).filter(Boolean).pop();
    if (last) return last;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
