import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoidAuditPage, VoidReference } from '@/api';

// Bounded keyset browsing. A new token, tenant or refresh invalidates old data
// and in-flight requests; no student/financial details are persisted offline.
type State = { key: string; records: VoidReference[]; cursor: string | null;
  hasMore: boolean; loadingMore: boolean; error?: Error; pageError?: Error };

export function useVoidAuditPages(
  fetchPage: (cursor?: string) => Promise<VoidAuditPage>, key: string, enabled: boolean,
) {
  const fetchRef = useRef(fetchPage);
  useEffect(() => { fetchRef.current = fetchPage; });
  const generation = useRef(0);
  const busy = useRef(false);
  const [version, setVersion] = useState(0);
  const viewKey = `${key}:${enabled}:${version}`;
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const id = ++generation.current;
    busy.current = false;
    if (!enabled) return () => { generation.current = id + 1; };
    void fetchRef.current().then(page => {
      if (generation.current !== id) return;
      setState({ key: viewKey, records: page.records, cursor: page.nextCursor,
        hasMore: page.hasMore, loadingMore: false });
    }, error => {
      if (generation.current !== id) return;
      setState({ key: viewKey, records: [], cursor: null, hasMore: false,
        loadingMore: false, error: error instanceof Error ? error : new Error('Unable to load Void audit') });
    });
    return () => { generation.current = id + 1; };
  }, [viewKey, enabled]);

  const current = state?.key === viewKey ? state : null;
  const loadMore = useCallback(async () => {
    if (!enabled || !current || !current.hasMore || !current.cursor || busy.current) return;
    const id = generation.current;
    busy.current = true;
    setState(prev => prev?.key === viewKey ? { ...prev, loadingMore: true, pageError: undefined } : prev);
    try {
      const next = await fetchRef.current(current.cursor);
      if (generation.current !== id) return;
      setState(prev => {
        if (!prev || prev.key !== viewKey) return prev;
        const known = new Set(prev.records.map(record => record.id));
        return { ...prev, records: [
          ...prev.records, ...next.records.filter(record => !known.has(record.id)),
        ], cursor: next.nextCursor, hasMore: next.hasMore, loadingMore: false };
      });
    } catch (e) {
      if (generation.current !== id) return;
      setState(prev => prev?.key === viewKey ? { ...prev,
        loadingMore: false, pageError: e instanceof Error ? e : new Error('Unable to load older Void records') } : prev);
    } finally { busy.current = false; }
  }, [current, viewKey, enabled]);

  return { records: current?.records, hasMore: current?.hasMore ?? false,
    loading: enabled && !current, loadingMore: current?.loadingMore ?? false,
    error: current?.error, pageError: current?.pageError,
    loadMore, reload: () => setVersion(n => n + 1) };
}
