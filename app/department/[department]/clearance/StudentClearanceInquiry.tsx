'use client';

import { useEffect, useRef, useState } from 'react';

type Stage = 'identity' | 'code' | 'result';
type StudentClearance = {
  status: 'cleared' | 'hold';
  ay: string;
  term: string;
  studentName: null;
  studentId: null;
  outstandingCentavos: null;
  unpaidItems: null;
  qrToken: null;
};

const friendlyError = (status: number) =>
  status === 429
    ? 'Too many verification attempts. Please try again later.'
    : status === 400 || status === 401
      ? 'The code or registered student credentials could not be verified.'
      : 'Clearance verification is unavailable at the moment. Please try again later.';

/** Status-only student self-service. All authorization is rechecked by server. */
export default function StudentClearanceInquiry({
  department,
  organizationName,
  academicYear,
  term,
}: {
  department: string;
  organizationName: string;
  academicYear: string;
  term: string;
}) {
  const [studentId, setStudentId] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('identity');
  const [result, setResult] = useState<StudentClearance | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const api = '/api/mobile/orgs/' + encodeURIComponent(department);

  // Legacy bookmark URLs may contain a student ID/email in the query string.
  // Remove these from the address/history. Never transmit them as a GET query.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('q')) {
      url.searchParams.delete('q');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);

  useEffect(() => () => {
    const bearer = tokenRef.current;
    tokenRef.current = null;
    if (bearer) {
      void fetch(api + '/clearance/auth/session', {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + bearer },
        keepalive: true,
      }).catch(() => {});
    }
  }, [api]);

  const postCode = async (path: string, payload: Record<string, string>) => {
    const response = await fetch(api + path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(friendlyError(response.status));
    return data;
  };

  const sendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentId.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registeredEmail.trim())) {
      setError('Enter your student ID and registered email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await postCode('/clearance/auth/request-code', {
        studentId: studentId.trim(),
        email: registeredEmail.trim().toLowerCase(),
      });
      // Always show a generic success regardless of account existence.
      setNotice('If the student ID and registered email match, a verification code has been sent.');
      setStage('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request a code.');
    } finally {
      setBusy(false);
    }
  };

  const checkOwn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit verification code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const auth = await postCode('/clearance/auth/verify-code', {
        studentId: studentId.trim(),
        email: registeredEmail.trim().toLowerCase(),
        code,
      });
      if (typeof auth?.token !== 'string') throw new Error('Verification could not be completed.');
      tokenRef.current = auth.token;
      const response = await fetch(api + '/clearance', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + auth.token, Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(friendlyError(response.status));
      const privateResult: StudentClearance = await response.json();
      if (!['cleared', 'hold'].includes(privateResult.status) ||
        privateResult.studentName !== null || privateResult.unpaidItems !== null ||
        privateResult.studentId !== null || privateResult.outstandingCentavos !== null ||
        privateResult.qrToken !== null) throw new Error('Verification response could not be validated.');
      setResult(privateResult);
      setCode('');
      setStage('result');
      setNotice('');
    } catch (err) {
      const bearer = tokenRef.current;
      tokenRef.current = null;
      if (bearer) void fetch(api + '/clearance/auth/session', {
        method: 'DELETE', credentials: 'same-origin', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + bearer },
      }).catch(() => {});
      setError(err instanceof Error ? err.message : 'Unable to check clearance.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const bearer = tokenRef.current;
    tokenRef.current = null;
    setCode('');
    setStudentId('');
    setRegisteredEmail('');
    setNotice('');
    setError('');
    setResult(null);
    setStage('identity');
    if (bearer) void fetch(api + '/clearance/auth/session', {
      method: 'DELETE', credentials: 'same-origin', cache: 'no-store',
      headers: { Authorization: 'Bearer ' + bearer },
    }).catch(() => {});
  };

  // On shared devices, clear any displayed status on tab switching or after
  // a short viewing window; this also revokes the in-memory student session.
  useEffect(() => {
    if (stage !== 'result') return;
    const timeout = window.setTimeout(() => void finish(), 2 * 60_000);
    const hide = () => {
      if (document.visibilityState === 'hidden') void finish();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [stage]);

  return (
    <section className="card border-secondary bg-body shadow-sm p-3 p-md-4">
      <h1 className="h4 text-info fw-bold">Private student clearance inquiry</h1>
      <p className="text-muted">
        {organizationName} · {term} ({academicYear}). Verify the email linked to your
        official student record to see your own live clearance status.
      </p>
      {notice && <div className="alert alert-info" role="status">{notice}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {stage === 'identity' && (
        <form onSubmit={sendCode} autoComplete="off">
          <label className="form-label" htmlFor="student-clearance-school-id">Your student ID</label>
          <input id="student-clearance-school-id" className="form-control mb-3" autoComplete="off"
            maxLength={80} required value={studentId} onChange={e => setStudentId(e.target.value)} />
          <label className="form-label" htmlFor="student-clearance-email">Registered school email</label>
          <input id="student-clearance-email" className="form-control mb-3" type="email"
            maxLength={254} required autoComplete="email" value={registeredEmail}
            onChange={e => setRegisteredEmail(e.target.value)} />
          <button type="submit" disabled={busy} className="btn btn-primary w-100">
            {busy ? 'Requesting verification…' : 'Send verification code'}
          </button>
        </form>
      )}

      {stage === 'code' && (
        <form onSubmit={checkOwn} autoComplete="off">
          <label className="form-label" htmlFor="student-clearance-otp">Six-digit code</label>
          <input id="student-clearance-otp" className="form-control mb-3" type="text"
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
            pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary w-100">
            {busy ? 'Checking clearance…' : 'Verify and check my clearance'}
          </button>
          <button type="button" disabled={busy} className="btn btn-link mt-2" onClick={() => {
            setStage('identity'); setCode(''); setError(''); setNotice('');
          }}>
            Use another registered email
          </button>
        </form>
      )}

      {stage === 'result' && result && (
        <div role="status" aria-live="polite">
          <div className={'alert ' + (result.status === 'cleared' ? 'alert-success' : 'alert-warning')}>
            <strong>{result.status === 'cleared' ? 'CLEARED' : 'CLEARANCE ON HOLD'}</strong>
            <p className="mb-0">As of {result.term} ({result.ay})</p>
          </div>
          <p className="small text-muted">
            Only your status is displayed. Ask an authorized officer for payment details or a signed clearance certificate.
          </p>
          <button type="button" onClick={finish} className="btn btn-outline-secondary w-100">
            Finish private inquiry
          </button>
        </div>
      )}

      <p className="small text-muted mt-3 mb-0">
        Your verification code expires after five minutes. Your temporary access expires
        after ten minutes. If your email is missing, contact your tenant administrator;
        knowing a student ID alone cannot authorize access.
      </p>
    </section>
  );
}
