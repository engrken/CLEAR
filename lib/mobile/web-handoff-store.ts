import 'server-only';
import { prisma } from '@/lib/prisma';
import { hashWebHandoffTicket } from '@/lib/mobile/web-handoff-ticket.mjs';

/**
 * Storage primitive only. The caller must independently validate source-session
 * revocation, principal status, tenant, maintenance and NextAuth sign-in.
 * An updateMany predicate makes concurrent redemption strictly consume-once.
 */
export async function consumeWebHandoffTicket(ticket: string, signingKey: string) {
  const ticketHash = hashWebHandoffTicket(ticket, signingKey);
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const changed = await tx.mobileWebHandoff.updateMany({
      where: { ticketHash, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (changed.count !== 1) return null;
    return tx.mobileWebHandoff.findUnique({
      where: { ticketHash },
      select: {
        id: true, principalType: true, principalId: true, organizationId: true,
        mobileSessionId: true, destination: true, expiresAt: true,
      },
    });
  });
}
