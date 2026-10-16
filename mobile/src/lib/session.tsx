import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Session } from '@/api';

type Ctx = {
  session: Session | null;
  signIn: (s: Session) => void;
  signOut: () => void;
  can: (tab: string) => boolean;
};

const SessionContext = createContext<Ctx | null>(null);

// Phase 2: persist the token in expo-secure-store and restore it at launch.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const value = useMemo<Ctx>(
    () => ({
      session,
      signIn: setSession,
      signOut: () => setSession(null),
      can: (tab) => !!session && (session.officer.role === 'admin' || session.officer.allowedTabs.includes(tab)),
    }),
    [session]
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
