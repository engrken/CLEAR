import { useCallback, useEffect, useRef, useState } from 'react';
import type { LedgerEntry, LedgerPage } from '@/api';

/** Fetch one bounded page at a time; no unbounded financial history download.
 * A key includes tenant + authenticated session and invalidates stale results.
 */
type View = { key: string; data: LedgerEntry[]; cursor: string | null;
  hasMore: boolean; loading: boolean; loadingMore: boolean;
  error?: Error; pageError?: Error };

export function useLedgerPages(
  fetchPage: (cursor?: string) => Promise<LedgerPage>,
  key: string,
  enabled: boolean,
) {
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const generation = useRef(0);
  const busyRef = useRef(false);
  const [version, setVersion] = useState(0);
  const viewKey = `${key}:${enabled}:${version}`;
  const [view, setView] = useState<View>();
  useEffect(() => {
    const id = ++generation.current;
    busyRef.current = false;
    if (!enabled) {
      setView({ key: viewKey, data: [], cursor: null, hasMore: false,
        loading: false, loadingMore: false });
      return () => { generation.current++; };
    }
    setView({ key: viewKey, data: [], cursor: null, hasMore: false,
      loading: true, loadingMore: false });
    void fetchRef.current().then(page => {
      if (generation.current !== id) return;
      setView({ key: viewKey, data: page.records, cursor: page.nextCursor,
        hasMore: page.hasMore, loading: false, loadingMore: false });
    }, error => {
      if (generation.current !== id) return;
      setView({ key: viewKey, data: [], cursor: null, hasMore: false,
        loading: false, loadingMore: false,
        error: error instanceof Error ? error : new Error('Could not load Activity') });
    });
    return () => { generation.current++; };
  }, [viewKey, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || !view || view.key !== viewKey || view.loading ||
        !view.hasMore || !view.cursor || busyRef.current) return;
    const id = generation.current;
    busyRef.current = true;
    setView(prev => prev && prev.key === viewKey
      ? { ...prev, pageError: undefined, loadingMore: true } : prev);
    try {
      const next = await fetchRef.current(view.cursor);
      if (generation.current !== id) return;
      setView(prev => {
        if (!prev || prev.key !== viewKey) return prev;
        const known = new Set(prev.data.map(r => `${r.kind}:${r.id}`));
        const additions = next.records.filter(r => !known.has(`${r.kind}:${r.id}`));
        return { ...prev, data: [...prev.data, ...additions], cursor: next.nextCursor,
          hasMore: next.hasMore, loadingMore: false, pageError: undefined };
      });
    } catch (error) {
      if (generation.current !== id) return;
      setView(prev => prev && prev.key === viewKey
        ? { ...prev, loadingMore: false,
          pageError: error instanceof Error ? error : new Error('Could not load older Activity') }
        : prev);
    } finally { busyRef.current = false; }
  }, [enabled, view, viewKey]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  const current = view?.key === viewKey ? view : undefined;
  return {
    data: current?.data, error: current?.error,
    pageError: current?.pageError,
    loading: !current || current.loading,
    loadingMore: current?.loadingMore ?? false,
    hasMore: current?.hasMore ?? false, loadMore, reload,
  };
}
