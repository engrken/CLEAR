export const HANDOFF_TTL_MS: number;
export const HANDOFF_TICKET_BYTES: number;
export function createWebHandoffTicket(secretKey: string, now?: number): {
  ticket: string; ticketHash: string; expiresAt: Date;
};
export function hashWebHandoffTicket(ticket: string, secretKey: string): string;
export function matchesWebHandoffTicket(ticket: string, expectedHash: string, secretKey: string): boolean;
export function canRedeemWebHandoff(record: {
  expiresAt: Date | string; consumedAt: Date | null; revokedAt: Date | null;
}, now?: number): boolean;
