// /app/dashboard/entity/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EntityAdminLoginPage() {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await fetch('/api/entity-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, step: 'request_otp' }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response.');
      }

      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data.message || 'Failed to request OTP.');

      setOtpSent(true);
      setInfoMessage(data.message || `A 6-digit OTP has been sent to ${email}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/entity-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode, step: 'verify_otp' }),
      });

      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data.message || 'OTP verification failed.');

      window.location.href = '/dashboard/entity/portal';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div
        className="card bg-dark text-white border-secondary p-4 shadow-lg"
        style={{ maxWidth: '420px', width: '100%', borderRadius: '1rem' }}
      >
        <div className="text-center mb-4">
          <div className="bg-info bg-opacity-10 border border-info border-opacity-25 text-info rounded-circle d-inline-flex p-3 mb-2">
            <i className="bi bi-shield-lock-fill fs-3"></i>
          </div>
          <h3 className="fw-bold mb-1">Entity Admin Portal</h3>
          <p className="text-secondary small mb-0">
            Secure Gmail OTP authentication to manage your institutional entity group and workspaces.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small text-center" role="alert">
            <i className="bi bi-exclamation-circle me-1"></i> {error}
          </div>
        )}

        {!otpSent ? (
          <form onSubmit={handleRequestOtp} className="vstack gap-3">
            <div>
              <label className="form-label small text-uppercase text-info fw-bold">
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@email.com"
                className="form-control bg-dark text-white border-secondary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-info fw-bold py-2 text-dark mt-2 shadow-sm"
            >
              {loading ? 'Sending OTP to Gmail...' : 'Send Login OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="vstack gap-3">
            <div className="alert alert-success py-2 small text-center mb-1">
              <i className="bi bi-envelope-check-fill me-1"></i> {infoMessage}
            </div>

            <div>
              <label className="form-label small text-uppercase text-info fw-bold">
                Enter 6-Digit OTP Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="form-control bg-dark text-white border-secondary text-center fs-4 fw-bold font-monospace"
                style={{ letterSpacing: '0.4em' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="btn btn-info fw-bold py-2 text-dark mt-2 shadow-sm"
            >
              {loading ? 'Verifying OTP...' : 'Verify & Open Entity Portal'}
            </button>

            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtpCode('');
                setError('');
              }}
              className="btn btn-link btn-sm text-secondary text-decoration-none"
            >
              Change email or request new code
            </button>
          </form>
        )}

        <div className="text-center mt-4 pt-2 border-top border-secondary border-opacity-25">
          <Link href="/dashboard" className="text-secondary small text-decoration-none">
            <i className="bi bi-arrow-left me-1"></i> Back to Main Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}