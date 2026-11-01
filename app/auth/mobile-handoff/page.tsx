'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Browser receives a short-lived ticket, never a mobile bearer credential. */
export default function MobileHandoffPage() {
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
        router.replace('/dashboard');
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
