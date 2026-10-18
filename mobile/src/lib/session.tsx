import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setUnauthorizedHandler, type Session } from '@/api';
import { deleteItem, getItem, setItem } from './secure-storage';

const KEY = 'clear.session.v1';

type Ctx = {
  session: Session | null;
  /** True until a stored session has been restored or ruled out. */
  restoring: boolean;
  signIn: (s: Session) => Promise<void>;
  signOut: () => Promise<void>;
  can: (tab: string) => boolean;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  const clear = useCallback(async () => {
    setSession(null);
    await deleteItem(KEY);
  }, []);

  // Restore at launch: re-check the stored token with the server. If the
  // server can't be reached, keep an unexpired stored session so officers can
  // still open the app; the next request re-validates it.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const raw = await getItem(KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as Session;
        if (Date.parse(stored.expiresAt) < Date.now()) return void (await deleteItem(KEY));
        try {
          const fresh = await api.restoreSession(stored.org.subdomain, stored.token);
          if (live) setSession(fresh);
          await setItem(KEY, JSON.stringify(fresh));
        } catch (e) {
          if (e instanceof ApiError && e.code === 'network') {
            if (live) setSession(stored);
          } else {
            await deleteItem(KEY);
          }
        }
      } catch {
        await deleteItem(KEY);
      } finally {
        if (live) setRestoring(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // Any 401 on an officer call signs out; the root guard then leaves the officer screens.
  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const value = useMemo<Ctx>(
    () => ({
      session,
      restoring,
      signIn: async (s) => {
        setSession(s);
        await setItem(KEY, JSON.stringify(s));
      },
      signOut: async () => {
        const s = session;
        await clear();
        if (s) await api.signOut(s);
      },
      can: (tab) => !!session && session.officer.allowedTabs.includes(tab),
    }),
    [session, restoring, clear]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For screens inside the officer group, where the guard guarantees a session. */
export function useOfficerSession(): Session {
  const { session } = useSession();
  if (!session) throw new Error('No officer session');
  return session;
}
