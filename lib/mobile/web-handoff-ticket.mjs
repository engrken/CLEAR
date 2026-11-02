import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const HANDOFF_TTL_MS = 60_000;
export const HANDOFF_TICKET_BYTES = 32;
const ticketPattern = /^[A-Za-z0-9_-]{43}$/;

/** Ticket secret is returned once; only its keyed digest belongs in persistent storage. */
export function createWebHandoffTicket(secretKey, now = Date.now()) {
  if (typeof secretKey !== 'string' || secretKey.length < 32) {
    throw new Error('Web handoff signing key is missing or too short.');
  }
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid issuance timestamp.');
  const ticket = randomBytes(HANDOFF_TICKET_BYTES).toString('base64url');
  return { ticket, ticketHash: hashWebHandoffTicket(ticket, secretKey), expiresAt: new Date(now + HANDOFF_TTL_MS) };
}

export function hashWebHandoffTicket(ticket, secretKey) {
  if (typeof ticket !== 'string' || !ticketPattern.test(ticket)) throw new Error('Invalid handoff ticket.');
  if (typeof secretKey !== 'string' || secretKey.length < 32) throw new Error('Invalid handoff signing key.');
  return createHmac('sha256', secretKey).update('CLEAR:web-handoff:v1:').update(ticket).digest('hex');
}

/** Defense-in-depth for hash comparisons; atomic database consumption is still mandatory. */
export function matchesWebHandoffTicket(ticket, expectedHash, secretKey) {
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  try {
    const candidate = Buffer.from(hashWebHandoffTicket(ticket, secretKey), 'hex');
    return timingSafeEqual(candidate, Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

/** No ticket may be redeemed at or after expiry, or after a successful consume. */
export function canRedeemWebHandoff({ expiresAt, consumedAt, revokedAt }, now = Date.now()) {
  const expiry = new Date(expiresAt).getTime();
  return consumedAt == null && revokedAt == null && Number.isFinite(expiry) &&
    Number.isFinite(now) && now >= 0 && now < expiry;
}
