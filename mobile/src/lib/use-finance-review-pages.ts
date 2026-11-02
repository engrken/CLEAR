import { useCallback, useEffect, useRef, useState } from 'react';
import type { FinanceReviewEntry, FinanceReviewResponse } from '@/api';

type State = { key: string; data: FinanceReviewResponse | null;
  loadingMore: boolean; error?: Error; pageError?: Error };

// Isolate pages by tenant, token and independently authorized module.
// All monetary values are canonical server-generated integer centavos.
export function useFinanceReviewPages(
  fetchPage: (cursor?: string) => Promise<FinanceReviewResponse>,
  key: string, enabled: boolean,
) {
  const requestRef = useRef(fetchPage);
  useEffect(() => { requestRef.current = fetchPage; });
  const generation = useRef(0);
  const busy = useRef(false);
  const [version, setVersion] = useState(0);
  const viewKey = `${key}:${enabled}:${version}`;
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const id = ++generation.current;
    busy.current = false;
    if (!enabled) return () => { generation.current = id + 1; };
    void requestRef.current().then(page => {
      if (generation.current !== id) return;
      setState({ key: viewKey, data: page, loadingMore: false });
    }, error => {
      if (generation.current !== id) return;
      setState({ key: viewKey, data: null, loadingMore: false,
        error: error instanceof Error ? error : new Error('Unable to load financial records') });
    });
    return () => { generation.current = id + 1; };
  }, [viewKey, enabled]);

  const current = state?.key === viewKey ? state : null;
  const loadMore = useCallback(async () => {
    const initial = current?.data;
    if (!enabled || !initial || !initial.hasMore || !initial.nextCursor || busy.current) return;
    const id = generation.current;
    busy.current = true;
    setState(prev => prev?.key === viewKey ? { ...prev, loadingMore: true, pageError: undefined } : prev);
    try {
      const next = await requestRef.current(initial.nextCursor);
      if (generation.current !== id) return;
      if (next.kind !== initial.kind || next.scope !== initial.scope ||
          next.ay !== initial.ay || next.term !== initial.term) throw new Error('Financial page scope changed. Refresh to retry.');
      setState(prev => {
        if (!prev || prev.key !== viewKey || !prev.data) return prev;
        const known = new Set(prev.data.entries.map(record => record.id));
        const unique: FinanceReviewEntry[] = next.entries.filter(record => !known.has(record.id));
        return { ...prev, loadingMore: false, data: {
          ...prev.data, entries: [...prev.data.entries, ...unique],
          hasMore: next.hasMore, nextCursor: next.nextCursor,
        } };
      });
    } catch (error) {
      if (generation.current !== id) return;
      setState(prev => prev?.key === viewKey ? { ...prev, loadingMore: false,
        pageError: error instanceof Error ? error : new Error('Unable to load older records') } : prev);
    } finally { busy.current = false; }
  }, [current, enabled, viewKey]);

  const reload = useCallback(() => setVersion(n => n + 1), []);
  return { data: current?.data, error: current?.error,
    pageError: current?.pageError, loading: enabled && !current,
    loadingMore: current?.loadingMore ?? false, loadMore, reload };
}
