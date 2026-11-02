/**
 * One outstanding Android cashier request per officer and tenant.
 * Its UUID survives a dropped response, app restart and OTP reauthentication.
 * Never silently replace an uncertain request with a different payment.
 */
export type PaymentDraft = Readonly<{ studentId: string; feeId: string; amountCentavos: number }>;
export type PendingPayment = Readonly<{ version: 1; key: string; draft: PaymentDraft }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Expo SecureStore only permits alphanumerics, period, dash and underscore in keys. */
export function paymentStorageKey(tenant: string, officerId: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant) ||
      !/^[A-Za-z0-9_-]{1,120}$/.test(officerId)) {
    throw new Error('Invalid officer or tenant identity for secure payment recovery.');
  }
  return 'clear.pending-payment.' + tenant + '.' + officerId;
}

/** Exact decimal parser: no binary-float multiplication or rounded centavos. */
export function parsePaymentCentavos(raw: string): number | null {
  const text = raw.trim();
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.replace(/,/g, '').split('.');
  if (whole.length > 7) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100_000_000 ? cents : null;
}

function validDraft(value: unknown): value is PaymentDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.studentId === 'string' && draft.studentId.length > 0 && draft.studentId.length <= 100 &&
    typeof draft.feeId === 'string' && draft.feeId.length > 0 && draft.feeId.length <= 200 &&
    typeof draft.amountCentavos === 'number' && Number.isSafeInteger(draft.amountCentavos) &&
    draft.amountCentavos > 0 && draft.amountCentavos <= 100_000_000;
}

function sameDraft(a: PaymentDraft, b: PaymentDraft): boolean {
  return a.studentId === b.studentId && a.feeId === b.feeId && a.amountCentavos === b.amountCentavos;
}

/** Malformed secure-store records are a reconciliation blocker, never an invitation to mint a new UUID. */
export function parsePendingPayment(saved: string | null): PendingPayment | null {
  if (saved === null) return null;
  try {
    const item: unknown = JSON.parse(saved);
    if (!item || typeof item !== 'object') throw Error('Invalid pending record');
    const record = item as Record<string, unknown>;
    // An earlier internal build stored a fingerprint instead of the draft.
    const legacy = typeof record.fingerprint === 'string' ? JSON.parse(record.fingerprint) as unknown : null;
    const draft = record.version === 1 ? record.draft : legacy;
    if (typeof record.key !== 'string' || !UUID.test(record.key) || !validDraft(draft)) {
      throw Error('Invalid pending data');
    }
    return { version: 1, key: record.key, draft };
  } catch {
    throw new Error('Saved payment recovery is unreadable. Verify receipts with an Administrator before resetting the app.');
  }
}

/** Reuse the exact key only for the exact draft. No new request while one may have posted. */
export function choosePendingPayment(current: PendingPayment | null, draft: PaymentDraft, createKey: () => string): PendingPayment {
  if (!validDraft(draft)) throw new Error('Invalid payment draft; nothing was submitted.');
  if (current) {
    if (!sameDraft(current.draft, draft)) {
      throw new Error('An earlier payment is awaiting confirmation. Retry the saved payment or reconcile its receipt before starting another.');
    }
    return current;
  }
  const key = createKey();
  if (!UUID.test(key)) throw new Error('Secure payment request ID unavailable; nothing was submitted.');
  return { version: 1, key, draft: { ...draft } };
}
