import { useCallback, useEffect, useRef, useState } from 'react';

type Settled<T> = { key: string; data?: T; error?: Error };

/**
 * Runs `fn` when `key` changes and whenever `reload` is called.
 * `key` names the inputs (e.g. the department slug); `fn` always sees the latest closure.
 */
export function useAsync<T>(fn: () => Promise<T>, key: string) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const [version, setVersion] = useState(0);
  const runKey = `${key}#${version}`;
  const [settled, setSettled] = useState<Settled<T>>();

  useEffect(() => {
    let live = true;
    fnRef.current().then(
      (data) => live && setSettled({ key: runKey, data }),
      (error: Error) => live && setSettled({ key: runKey, error })
    );
    return () => {
      live = false;
    };
  }, [runKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const loading = settled?.key !== runKey;
  // Keep showing the last data while a reload is in flight.
  return { data: settled?.data, error: loading ? undefined : settled?.error, loading, reload };
}
