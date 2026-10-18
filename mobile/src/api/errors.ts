// Plain-language messages for API error codes. The server's own message wins;
// these are used only when a response carries a code but no message.

const MESSAGES: Record<string, string> = {
  period_closed: 'This term is closed. Ask an administrator.',
  duplicate_or: 'This OR number is already used. Check the receipt booklet.',
  overpayment: 'This amount is more than the balance due for this item.',
  invalid_student: 'This student isn’t on the department’s active roster.',
  rate_limited: 'Too many attempts. Wait a minute, then try again.',
  invalid_code: 'Invalid or expired verification code.',
  payload_too_large: 'This file is over 4 MB. Choose a smaller screenshot.',
  unauthorized: 'Your session has ended. Sign in again.',
  forbidden: 'Your role can’t use this module.',
  not_found: 'This record no longer exists.',
};

export function fallbackMessage(code: string, status: number): string {
  return MESSAGES[code] ?? `Request failed (${status}).`;
}
