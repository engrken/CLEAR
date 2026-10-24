import type { LedgerEntry } from '../api/types';

/**
 * Searches only the bounded, already-authorized activity returned by CLEAR.
 * It must never be described as a complete OR history / Void Center audit.
 * The backend independently checks tenant and role for every data request.
 */
export type RecentActivityFilter = 'all' | 'receipts' | 'voided';

export function filterRecentActivity(
  rows: readonly LedgerEntry[],
  rawQuery: string,
  kind: RecentActivityFilter = 'all',
): LedgerEntry[] {
  const q = rawQuery.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (kind === 'receipts' && row.kind !== 'collection') return false;
    if (kind === 'voided' && (row.kind !== 'collection' || !/void/i.test(row.status))) return false;
    if (!q) return true;
    return [row.title, row.reference, row.receiptNumber, row.subtitle, row.status]
      .some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(q));
  });
}
