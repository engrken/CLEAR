'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Browser receives a short-lived ticket, never a mobile bearer credential. */
function MobileHandoffExchange() {
  const params = useSearchParams();
  const router = useRouter();
  const attempted = useRef(false);
  const [message, setMessage] = useState('Signing you in securely…');
  const ticket = params.get('ticket');
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    // Remove the secret from browser history immediately, before the exchange.
    window.history.replaceState(null, '', '/auth/mobile-handoff');
    if (!ticket || !/^[A-Za-z0-9_-]{43}$/.test(ticket) || params.size !== 1) {
      setMessage('This sign-in link is invalid. Please sign in on the web portal.');
      return;
    }
    void (async () => {
      try {
        const result = await signIn('mobile-handoff', { ticket, redirect: false });
        if (!result?.ok || result.error) {
          setMessage('This sign-in link expired or was already used. Please sign in on the web portal.');
          return;
        }
        const session = await getSession();
        const user = session?.user as (typeof session.user & { department?: string | null; role?: string }) | undefined;
        if (!user) { setMessage('Browser session could not be verified. Please sign in on the web portal.'); return; }
        if (user.role === 'SuperAdmin') { router.replace('/dashboard/provisions'); return; }
        if (user.department && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(user.department)) {
          router.replace(`/department/${user.department}`);
          return;
        }
        setMessage('Your department could not be verified. Please sign in on the web portal.');
      } catch {
        setMessage('Unable to complete browser sign-in. Please sign in on the web portal.');
      }
    })();
  }, [ticket, params, router]);
  return <main style={{ maxWidth: 440, margin: '12vh auto', padding: 24, fontFamily: 'system-ui' }}>
    <h1>CLEAR secure browser sign-in</h1>
    <p role="status">{message}</p>
    <a href="/">Return to web sign-in</a>
  </main>;
}

export default function MobileHandoffPage() {
  return <Suspense fallback={<main><p role="status">Preparing secure browser sign-in…</p></main>}>
    <MobileHandoffExchange />
  </Suspense>;
}
