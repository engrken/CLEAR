"use client";

import { useState, useEffect } from 'react';
import { requestOtp, verifyOtp } from './auth-actions';

export default function LoginModal({ 
  show, 
  onClose, 
  department 
}: { 
  show: boolean; 
  onClose: () => void; 
  department: string; 
}) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal is toggled
  useEffect(() => {
    if (show) {
      setStep('email');
      setEmail('');
      setOtp('');
      setError(null);
    }
  }, [show]);

  if (!show) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Please enter your institutional email.");
    
    setIsLoading(true);
    setError(null);
    try {
      const res = await requestOtp(department, email);
      if (res.success) {
        setStep('otp');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return setError("Please enter a valid 6-digit code.");

    setIsLoading(true);
    setError(null);
    try {
      const res = await verifyOtp(department, email, otp);
      if (res.success) {
        // Save user to local storage and force a full page reload to unlock the UI menus
        localStorage.setItem('fcu_clear_user', JSON.stringify(res.user));
        window.location.reload(); 
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content card border-secondary shadow-lg bg-card text-color">
          
          <div className="modal-header border-secondary">
            <h5 className="modal-title d-flex align-items-center fw-bold">
              <i className="bi bi-shield-lock-fill text-primary me-2 fs-4"></i>
              Departmental Authorization
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>

          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger py-2 small mb-3">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
              </div>
            )}

            {step === 'email' ? (
              <form onSubmit={handleRequestOtp}>
                <p className="text-secondary small mb-3">
                  Enter your registered institutional email address. A 6-digit verification code will be dispatched to your inbox.
                </p>
                <div className="mb-3">
                  <label className="form-label text-secondary small fw-semibold">Email Address</label>
                  <input 
                    type="email" 
                    className="form-control bg-card text-color border-secondary" 
                    placeholder="officer@domain.edu.ph" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={isLoading}>
                  {isLoading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <p className="text-secondary small mb-1">We sent a verification code to:</p>
                <div className="fw-bold text-accent mb-3">{email}</div>
                
                <div className="mb-3">
                  <label className="form-label text-secondary small fw-semibold">Enter 6-Digit Code</label>
                  <input 
                    type="text" 
                    className="form-control bg-card text-color border-secondary text-center fs-4 font-monospace py-2" 
                    maxLength={6} 
                    placeholder="000000" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    required 
                    autoFocus
                  />
                </div>
                
                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-success fw-bold" disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-link btn-sm text-secondary text-decoration-none mt-1" 
                    onClick={() => { setStep('email'); setOtp(''); setError(null); }}
                    disabled={isLoading}
                  >
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}