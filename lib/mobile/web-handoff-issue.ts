import 'server-only';
import { prisma } from '@/lib/prisma';
import { createWebHandoffTicket } from '@/lib/mobile/web-handoff-ticket.mjs';

const WEB_ORIGIN = 'https://clearsys.vercel.app';

export function isWebHandoffEnabled() {
  return process.env.MOBILE_WEB_HANDOFF_ENABLED === 'true' &&
    process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF === 'main';
}

export async function issueWebHandoff(input: {
  principalType: 'officer' | 'global'; principalId: string;
  organizationId: string | null; mobileSessionId: string; destination: string;
}) {
  if (!isWebHandoffEnabled()) throw new Error('Web handoff is disabled.');
  const key = process.env.MOBILE_WEB_HANDOFF_SECRET;
  if (!key || key.length < 32) throw new Error('Web handoff signing key is not configured.');
  if ((input.principalType === 'officer') !== Boolean(input.organizationId)) throw new Error('Invalid handoff scope.');
  if (input.principalType === 'officer' && !/^\/department\/[a-z0-9-]+$/.test(input.destination)) throw new Error('Invalid tenant destination.');
  if (input.principalType === 'global' && input.destination !== '/dashboard/provisions') throw new Error('Invalid global destination.');
  const { ticket, ticketHash, expiresAt } = createWebHandoffTicket(key);
  await prisma.mobileWebHandoff.create({ data: { ticketHash, expiresAt, ...input } });
  return { url: `${WEB_ORIGIN}/auth/mobile-handoff?ticket=${encodeURIComponent(ticket)}` };
}
