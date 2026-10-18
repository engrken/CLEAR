// /app/dashboard/components/AdminOtpModal.tsx

'use client';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";

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

  // --------------------------------------------------
  // RESEND COUNTDOWN
  // --------------------------------------------------
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) =>
        prev > 0 ? prev - 1 : 0
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // --------------------------------------------------
  // SEND OTP
  // --------------------------------------------------
  const handleSendOtp = async (
    e?: React.FormEvent
  ) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
      
    setLoading(true);
    setDevNotice('');
    try {
      const res = await fetch(
        '/api/auth/send-otp',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        void clearAlert(
          data.message ||
          'Failed to dispatch OTP.'
        );
        return;
      }
      setEmail(cleanEmail);
      setDevNotice(
        data.message ||
        'Verification code sent successfully.'
      );
      setStep('code');
      setResendTimer(60);
    } catch (error) {
      console.error(
        'OTP request error:',
        error
      );
      void clearAlert(
        'Failed to connect to authentication server.'
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // VERIFY OTP
  // --------------------------------------------------
  const handleVerifyOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    if (code.length !== 6) {
      void clearAlert(
        'Please enter the complete 6-digit verification code.'
      );
      return;
    }
    setLoading(true);
    try {
      const result = await signIn(
        'credentials',
        {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          redirect: false,
        }
      );

      // 🚀 FIX: Properly extract result.code (CustomAuthError message) instead of showing "CredentialsSignin"
      if (!result || result.error) {
        const errorMsg = (result as any)?.code || result?.error || 'No login response';
        void clearAlert(errorMsg === 'CredentialsSignin' ? 'Invalid verification code or unauthorized access.' : errorMsg);
        setCode('');
        return;
      }

      // ------------------------------------------------
      // CLOSE BOOTSTRAP MODAL
      // ------------------------------------------------
      const modalEl =
        document.getElementById(
          'otpAuthModal'
        );
      if (
        modalEl &&
        typeof window !== 'undefined' &&
        (window as any).bootstrap
      ) {
        const modal =
          (window as any).bootstrap.Modal
            .getInstance(modalEl);
        modal?.hide();
      }

      // ------------------------------------------------
      // CLEAN BOOTSTRAP BACKDROP
      // ------------------------------------------------
      document.body.classList.remove(
        'modal-open'
      );
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document
        .querySelectorAll(
          '.modal-backdrop'
        )
        .forEach((el) => el.remove());

      // ------------------------------------------------
      // RESET COMPONENT
      // ------------------------------------------------
      setCode('');
      setDevNotice('');
      setResendTimer(0);

      // ------------------------------------------------
      // GO TO MASTER ADMIN
      // ------------------------------------------------
      router.push(
        '/dashboard/provisions'
      );
      router.refresh();
    } catch (error) {
      console.error(
        'OTP verification error:',
        error
      );
      void clearAlert(
        'Verification failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div
      className="modal fade"
      id="otpAuthModal"
      tabIndex={-1}
      aria-hidden="true"
      data-bs-backdrop="static"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-card border-secondary text-color p-4 shadow-lg clear-theme-modal">
          {/* HEADER */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="modal-title text-accent fw-bold">
              <i className="bi bi-shield-lock-fill me-2"></i>
              System Admin Authentication
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>

          {/* ==================================================
              EMAIL STEP
          ================================================== */}
          {step === 'email' ? (
            <form onSubmit={handleSendOtp}>
              <p className="text-secondary small mb-3">
                Verify your identity as the system administrator.
                A 6-digit OTP will be dispatched to your
                authorized email address.
              </p>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">
                  System Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="form-control bg-body text-color border-secondary py-2"
                  placeholder="admin@domain.com"
                  autoComplete="email"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-info w-100 fw-bold py-2 text-dark"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <i className="bi bi-envelope-fill me-2"></i>
                    Dispatch Verification Code
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ==================================================
                OTP STEP
            ================================================== */
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-3 text-center">
                <p className="text-secondary small mb-1">
                  Code dispatched securely to:
                </p>
                <span className="text-info fw-bold fs-6">
                  {email}
                </span>
              </div>
              {devNotice && (
                <div className="alert alert-secondary bg-dark border-secondary text-light small py-2 px-3 mb-3 text-center">
                  <i className="bi bi-envelope-check me-2"></i>
                  {devNotice}
                </div>
              )}
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">
                  Enter 6-Digit Code
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .replace(/\D/g, '')
                        .slice(0, 6)
                    )
                  }
                  className="form-control bg-body text-color border-secondary text-center fs-3 tracking-widest fw-bold py-2"
                  placeholder="••••••"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-success w-100 fw-bold py-2 mb-4 text-white"
                disabled={
                  loading ||
                  code.length !== 6
                }
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                    />
                    Verifying...
                  </>
                ) : (
                  <>
                    <i className="bi bi-unlock-fill me-2"></i>
                    Verify & Unlock System
                  </>
                )}
              </button>
              {/* ACTIONS */}
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
                  <i className="bi bi-arrow-left me-1"></i>
                  Change Email
                </button>
                <button
                  type="button"
                  className={`btn btn-link text-decoration-none small p-0 ${
                    resendTimer > 0
                      ? 'text-muted'
                      : 'text-info fw-bold'
                  }`}
                  onClick={() =>
                    handleSendOtp()
                  }
                  disabled={
                    resendTimer > 0 ||
                    loading
                  }
                >
                  {resendTimer > 0
                    ? `Resend Code in ${resendTimer}s`
                    : 'Resend Code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}