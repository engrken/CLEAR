// /lib/errors.ts
//
// Business-rule failures with a stable code. Server actions surface `message`
// to the web UI; the mobile API maps `code` to an HTTP status and JSON error.

export type DomainErrorCode =
  | 'invalid'
  | 'not_found'
  | 'conflict'
  | 'duplicate_or'
  | 'invalid_student'
  | 'payload_too_large'
  | 'rate_limited';

export class DomainError extends Error {
  constructor(message: string, public code: DomainErrorCode) {
    super(message);
    this.name = 'DomainError';
  }
}

/** True for Prisma's unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
