'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

type Stage = 'identity' | 'current_code' | 'new_address' | 'new_code' | 'complete';
const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.trim().length <= 254;

/** Separate, self-service change of the verified student's roster email only. */
export default function StudentEmailChange({ department }: { department: string }) {
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<Stage>('identity');
  const [studentId, setStudentId] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const base = '/api/mobile/orgs/' + encodeURIComponent(department);

  const revoke = () => {
    const token = tokenRef.current;
    tokenRef.current = null;
    if (token) void fetch(base + '/clearance/auth/session', {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', keepalive: true,
    }).catch(() => {});
  };
  useEffect(() => () => revoke(), [base]);

  const post = async (path: string, payload: object, useToken = false) => {
    const token = tokenRef.current;
    if (useToken && !token) throw new Error('Verification expired. Start again.');
    const res = await fetch(base + path, {
      method: 'POST', cache: 'no-store',
      headers: {
        'Content-Type': 'application/json', Accept: 'application/json',
        ...(useToken && token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(res.status === 429
      ? 'Too many verification attempts. Please try again later.'
      : (res.status === 400 || res.status === 401)
        ? 'Verification was invalid or expired. Please verify again.'
        : body?.error?.message || 'Email verification is unavailable. Try again later.');
    return body;
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to verify the email change.');
    } finally { setBusy(false); }
  };
  const submitCurrent = (event: FormEvent) => {
    event.preventDefault();
    if (!studentId.trim() || !emailValid(currentEmail)) return setError('Enter your Student ID and current registered email.');
    void run(async () => {
      await post('/clearance/auth/request-code', { studentId: studentId.trim(), email: currentEmail.trim().toLowerCase() });
      setStage('current_code');
      setNotice('If your ID and registered email match, a code has been sent to your current email.');
    });
  };
  const verifyCurrent = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the six-digit current-email code.');
    void run(async () => {
      const session = await post('/clearance/auth/verify-code', { studentId: studentId.trim(), email: currentEmail.trim().toLowerCase(), code });
      if (typeof session?.token !== 'string') throw new Error('Verification unavailable.');
      tokenRef.current = session.token;
      setCode(''); setStage('new_address');
      setNotice('Current email verified. Enter the new address you control.');
    });
  };
  const sendNew = (event: FormEvent) => {
    event.preventDefault();
    if (!emailValid(newEmail) || currentEmail.trim().toLowerCase() === newEmail.trim().toLowerCase())
      return setError('Enter a different, valid new email address.');
    void run(async () => {
      await post('/clearance/email-change/request-new', { newEmail: newEmail.trim().toLowerCase() }, true);
      setCode(''); setStage('new_code');
      setNotice('If this new address is eligible, a code has been sent there.');
    });
  };
  const confirmNew = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the six-digit code sent to the new address.');
    void run(async () => {
      await post('/clearance/email-change/confirm', { newEmail: newEmail.trim().toLowerCase(), code }, true);
      tokenRef.current = null; // Server revoked old-email clearance token transactionally.
      setCode(''); setStage('complete');
      setNotice('Your roster email has been updated. Use the new email for your next clearance verification.');
    });
  };
  const reset = () => {
    revoke(); setStage('identity'); setStudentId(''); setCurrentEmail(''); setNewEmail('');
    setCode(''); setNotice(''); setError('');
  };

  return (
    <section className="card border-secondary bg-body shadow-sm p-3 p-md-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 fw-bold mb-1">Student roster email</h2>
          <p className="small text-muted mb-0">Change only your own registered email using verification at both addresses.</p>
        </div>
        <button type="button" className="btn btn-outline-info btn-sm" onClick={() => {
          if (expanded) reset();
          setExpanded(!expanded);
        }}>{expanded ? 'Close' : 'Change my email'}</button>
      </div>
      {expanded && (
        <div className="mt-3">
          <p className="small text-muted">You must have access to your current registered email. If you no longer have access, contact your organization administrator for manual identity verification.</p>
          {notice && <div className="alert alert-info" role="status">{notice}</div>}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {stage === 'identity' && <form onSubmit={submitCurrent}>
            <label className="form-label" htmlFor="email-change-student">Student ID</label>
            <input className="form-control mb-2" id="email-change-student" maxLength={80} required
              value={studentId} onChange={e => setStudentId(e.target.value)} autoComplete="off" />
            <label className="form-label" htmlFor="email-change-old">Current registered email</label>
            <input className="form-control mb-3" id="email-change-old" type="email" required maxLength={254}
              value={currentEmail} onChange={e => setCurrentEmail(e.target.value)} />
            <button className="btn btn-info" type="submit" disabled={busy}>Send code to current email</button>
          </form>}
          {stage === 'current_code' && <form onSubmit={verifyCurrent}>
            <label className="form-label" htmlFor="email-change-current-code">Code from current email</label>
            <input className="form-control mb-3" id="email-change-current-code" type="text" inputMode="numeric"
              pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} />
            <button className="btn btn-info" type="submit" disabled={busy}>Verify current email</button>
          </form>}
          {stage === 'new_address' && <form onSubmit={sendNew}>
            <label className="form-label" htmlFor="email-change-new">New email address</label>
            <input className="form-control mb-3" id="email-change-new" type="email" required maxLength={254}
              value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            <button className="btn btn-info" type="submit" disabled={busy}>Send code to new email</button>
          </form>}
          {stage === 'new_code' && <form onSubmit={confirmNew}>
            <label className="form-label" htmlFor="email-change-new-code">Code from new email</label>
            <input className="form-control mb-3" id="email-change-new-code" type="text" inputMode="numeric"
              pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} />
            <button className="btn btn-info" type="submit" disabled={busy}>Verify and update roster email</button>
          </form>}
          {stage === 'complete' && <button className="btn btn-outline-secondary" type="button" onClick={reset}>Finish</button>}
        </div>
      )}
    </section>
  );
}
