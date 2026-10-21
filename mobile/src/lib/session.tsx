import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setUnauthorizedHandler, type GlobalSession, type Session } from '@/api';
import { deleteItem, getItem, setItem } from './secure-storage';

const OFFICER_KEY = 'clear.session.v1';
const GLOBAL_KEY = 'clear.global-session.v1';

type Ctx = {
  session: Session | null;
  globalSession: GlobalSession | null;
  restoring: boolean;
  signIn: (s: Session) => Promise<void>;
  signInGlobal: (s: GlobalSession) => Promise<void>;
  signOut: () => Promise<void>;
  can: (tab: string) => boolean;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [globalSession, setGlobalSession] = useState<GlobalSession | null>(null);
  const [restoring, setRestoring] = useState(true);

  const clear = useCallback(async () => {
    setSession(null);
    setGlobalSession(null);
    await Promise.all([deleteItem(OFFICER_KEY), deleteItem(GLOBAL_KEY)]);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // Global sessions never open offline: revalidate role, status and sessionVersion.
        const globalRaw = await getItem(GLOBAL_KEY);
        if (globalRaw) {
          try {
            const stored = JSON.parse(globalRaw) as GlobalSession;
            if (Date.parse(stored.expiresAt) > Date.now()) {
              const verified = await api.restoreGlobalSession(stored.token);
              if (live) setGlobalSession(verified);
              await setItem(GLOBAL_KEY, JSON.stringify(verified));
              await deleteItem(OFFICER_KEY);
              return;
            }
          } catch {
            // A disconnected or invalidated global session cannot grant offline privileges.
          }
          await deleteItem(GLOBAL_KEY);
        }

        // The established officer behavior is preserved for existing releases.
        const raw = await getItem(OFFICER_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as Session;
        if (Date.parse(stored.expiresAt) <= Date.now()) {
          await deleteItem(OFFICER_KEY);
          return;
        }
        try {
          const fresh = await api.restoreSession(stored.org.subdomain, stored.token);
          if (live) setSession(fresh);
          await setItem(OFFICER_KEY, JSON.stringify(fresh));
        } catch (e) {
          if (e instanceof ApiError && e.code === 'network') {
            if (live) setSession(stored);
          } else {
            await deleteItem(OFFICER_KEY);
          }
        }
      } catch {
        await Promise.all([deleteItem(OFFICER_KEY), deleteItem(GLOBAL_KEY)]);
      } finally {
        if (live) setRestoring(false);
      }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const value = useMemo<Ctx>(() => ({
    session,
    globalSession,
    restoring,
    signIn: async (officerSession) => {
      await deleteItem(GLOBAL_KEY);
      setGlobalSession(null);
      await setItem(OFFICER_KEY, JSON.stringify(officerSession));
      setSession(officerSession);
    },
    signInGlobal: async (adminSession) => {
      await deleteItem(OFFICER_KEY);
      setSession(null);
      await setItem(GLOBAL_KEY, JSON.stringify(adminSession));
      setGlobalSession(adminSession);
    },
    signOut: async () => {
      const officer = session;
      const admin = globalSession;
      await clear();
      if (officer) await api.signOut(officer);
      if (admin) await api.signOutGlobal(admin);
    },
    can: (tab) => !!session && session.officer.allowedTabs.includes(tab),
  }), [session, globalSession, restoring, clear]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export function useOfficerSession(): Session {
  const { session } = useSession();
  if (!session) throw new Error('No officer session');
  return session;
}

export function useGlobalSession(): GlobalSession {
  const { globalSession } = useSession();
  if (!globalSession) throw new Error('No global-admin session');
  return globalSession;
}
