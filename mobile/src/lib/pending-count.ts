import { useSyncExternalStore } from 'react';

/**
 * Pending online remittances, for the Verify tab badge. Home (dashboard pendingCount)
 * and the Verify queue (its length) already load this number and report it here,
 * so the badge needs no request of its own. null = not known yet.
 */
let count: number | null = null;
const listeners = new Set<() => void>();

export function setPendingCount(next: number | null) {
  if (next === count) return;
  count = next;
  listeners.forEach((l) => l());
}

export function usePendingCount() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count,
    () => count,
  );
}
