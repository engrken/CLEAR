/**
 * Opt-in receipt-group paging is sound only for a single academic period
 * and an unfiltered full history. Statuses and anomaly filters require
 * full-group evaluation until audited SQL predicates exist.
 */
export type ReceiptHistoryFilters = {
  ay: string;
  term: string;
  q: string;
  exactOr: string;
  status: string;
  category: string;
  description: string;
  paymentType: string;
  from: string;
  to: string;
  inconsistentOnly: boolean;
};
export function canPageDefaultReceiptHistory(filters: ReceiptHistoryFilters): boolean {
  return Boolean(filters.ay && filters.term && !filters.q && !filters.exactOr &&
    filters.status === 'all' && !filters.category && !filters.description &&
    !filters.paymentType && !filters.from && !filters.to && !filters.inconsistentOnly);
}
