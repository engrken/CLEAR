'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminOtpModal() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [devNotice, setDevNotice] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const router = useRouter();

  // Countdown effect for the Resend button
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (email !== 'kent.bsece@gmail.com') {
      alert('Access Denied: Unrecognized super administrator email.');
      return;
    }

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
        setResendTimer(60); // Start 60s cooldown
      } else {
        alert(data.message || 'Failed to dispatch OTP.');
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
        const modalEl = document.getElementById("otpAuthModal");
        if (modalEl && typeof window !== 'undefined' && (window as any).bootstrap) {
          const modal = (window as any).bootstrap.Modal.getInstance(modalEl);
          modal?.hide();
        }
        
        // MANUALLY CLEAN UP BOOTSTRAP BACKDROP AND CLASSES
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal fade" id="otpAuthModal" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-card border-secondary text-color p-4 shadow-lg">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="modal-title text-accent fw-bold">
              <i className="bi bi-shield-lock-fill me-2"></i>Super Admin Authentication
            </h5>
            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp}>
              <p className="text-secondary small mb-3">
                Verify your identity as the system architect. A 6-digit OTP will be dispatched to your inbox.
              </p>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Super Admin Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control bg-body text-color border-secondary py-2"
                  placeholder="user@email.com" 
                  required 
                />
              </div>
              <button type="submit" className="btn btn-info w-100 fw-bold py-2 text-dark" disabled={loading}>
                {loading ? 'Transmitting...' : 'Dispatch Verification Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-3 text-center">
                <p className="text-secondary small mb-1">Code dispatched securely to:</p>
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
                  className="form-control bg-body text-color border-secondary text-center fs-3 tracking-widest fw-bold py-2"
                  placeholder="******" 
                  required 
                />
              </div>

              <button type="submit" className="btn btn-success w-100 fw-bold py-2 mb-4 text-white" disabled={loading}>
                {loading ? 'Verifying Payload...' : 'Verify & Unlock System'}
              </button>

              <div className="d-flex justify-content-between align-items-center px-2">
                <button 
                  type="button" 
                  className="btn btn-link text-secondary text-decoration-none small p-0"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setDevNotice('');
                    setResendTimer(0);
                  }}
                >
                  Change Email
                </button>

                <button 
                  type="button" 
                  className={`btn btn-link text-decoration-none small p-0 ${resendTimer > 0 ? 'text-muted' : 'text-info fw-bold'}`}
                  onClick={() => handleSendOtp()}
                  disabled={resendTimer > 0 || loading}
                >
                  {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}