'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function OtpModal({ department }: { department: string }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [devNotice, setDevNotice] = useState('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDevNotice('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (data.success) {
        setDevNotice(data.message);
        setStep('code');
      } else {
        alert(data.message || 'Email address not found in authorized officers roster.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        code,
        redirect: false,
      });

      if (result?.error) {
        alert(result.error);
      } else {
        window.location.href = `http://${department}.localhost:3000`;
      }
    } catch (err) {
      console.error(err);
      alert('Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade" id="otpAuthModal" tabIndex={-1} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-card border-secondary text-color p-4 shadow-lg">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="modal-title text-accent fw-bold">
              <i className="bi bi-shield-lock-fill me-2"></i>Departmental Authorization
            </h5>
            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp}>
              <p className="text-secondary small mb-3">
                Enter your registered institutional email address. A 6-digit verification code will be dispatched to your inbox.
              </p>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control bg-card text-color border-secondary py-2"
                  placeholder="officer@domain.edu.ph" 
                  required 
                />
              </div>
              <button type="submit" className="btn btn-info w-100 fw-bold py-2 text-dark" disabled={loading}>
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-3 text-center">
                <p className="text-secondary small mb-1">We sent a verification code to:</p>
                <span className="text-info fw-bold fs-6">{email}</span>
              </div>

              {devNotice && (
                <div className="alert alert-secondary bg-dark border-secondary text-light small py-2 px-3 mb-3 text-center">
                  {devNotice}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Enter 6-Digit Code</label>
                <input 
                  type="text" 
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="form-control bg-card text-color border-secondary text-center fs-3 tracking-widest fw-bold py-2"
                  placeholder="000000" 
                  required 
                />
              </div>

              <button type="submit" className="btn btn-success w-100 fw-bold py-2 mb-3 text-white" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <div className="text-center">
                <button 
                  type="button" 
                  className="btn btn-link text-secondary text-decoration-none small p-0"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setDevNotice('');
                  }}
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}