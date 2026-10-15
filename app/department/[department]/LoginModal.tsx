// /app/department/[department]/LoginModal.tsx
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { requestOtp } from "./auth-actions";
import { useRouter } from "next/navigation";
export default function LoginModal({
  show,
  onClose,
  department,
  orgName,
}: {
  show: boolean;
  onClose: () => void;
  department: string;
  orgName?: string;
}){
  const router = useRouter();
  const [step, setStep] =
    useState<"email" | "code">("email");
  const [email, setEmail] =
    useState("");
  const [code, setCode] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");

  // =========================================================
  // RESET
  // =========================================================
  const resetLogin = () => {
    setStep("email");
    setEmail("");
    setCode("");
    setMessage("");
    setError("");
    setLoading(false);
  };

  // =========================================================
  // CLOSE
  // =========================================================
  const handleClose = () => {
    if (loading) return;
    resetLogin();
    onClose();
  };

  // =========================================================
  // SEND OTP
  // =========================================================
  const handleSendOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const cleanEmail =
      email.trim().toLowerCase();
    if (!cleanEmail) {
      setError(
        "Please enter your email address."
      );
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(
        department,
        cleanEmail
      );
      if (!result?.success) {
        setError(
          result?.message ||
            "Unable to send verification code."
        );
        return;
      }
      setEmail(cleanEmail);
      setMessage(
        result.message ||
          "A verification code has been sent to your email address."
      );
      setStep("code");
    } catch (error) {
      console.error(
        "OTP request error:",
        error
      );
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // VERIFY OTP
  // =========================================================
  const handleVerifyOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setError("");
    setMessage("");
    const cleanEmail =
      email.trim().toLowerCase();
    const cleanDepartment =
      decodeURIComponent(department)
        .trim()
        .toLowerCase();

    const cleanCode =
      code.trim();

    if (cleanCode.length !== 6) {
      setError(
        "Please enter the complete 6-digit verification code."
      );
      return;
    }
    setLoading(true);
    try {
      console.log(
        "Starting NextAuth OTP verification..."
      );
      const result = await signIn(
        "credentials",
        {
          email: cleanEmail,
          code: cleanCode,
          department: cleanDepartment,
          redirect: false,
        }
      );
      console.log(
        "NextAuth signIn result:",
        result
      );
      if (!result) {
        setError(
          "No response was received from the authentication server."
        );
        return;
      }
      if (result.error) {
        console.error(
          "NextAuth authentication error:",
          result.error
        );
        if (
          result.error ===
          "CredentialsSignin"
        ) {
          setError(
            "The verification code was rejected. Please make sure you are using the latest OTP."
          );
        } else {
          setError(result.error);
        }
        return;
      }

      // =====================================================
      // AUTHENTICATION SUCCESSFUL
      // =====================================================
      console.log(
        "Authentication successful."
      );
      window.location.href =
        `/department/${encodeURIComponent(cleanDepartment)}`;
		} catch (error) {
      console.error(
        "OTP verification error:",
        error
      );
      setError(
        error instanceof Error
          ? error.message
          : "Verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // DON'T RENDER
  // =========================================================
  if (!show) {
    return null;
  }

  // =========================================================
  // UI
  // =========================================================
  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{
        backgroundColor:
          "rgba(0, 0, 0, 0.75)",
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-card border-secondary text-color shadow-lg">

          {/* =================================================
              HEADER
          ================================================= */}
          <div className="modal-header border-secondary">
            <h5 className="modal-title text-accent fw-bold">
              <i className="bi bi-shield-lock-fill me-2"></i>
              Departmental Authorization
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={handleClose}
              disabled={loading}
              aria-label="Close"
            />
          </div>
          {/* =================================================
              BODY (Encloses all inputs, alerts, and forms)
          ================================================= */}
          <div className="modal-body p-4">
            {/* DEPARTMENT BADGE */}
            <div className="text-center mb-4">
              {/* Use orgName if provided, otherwise fallback to the capitalized department slug */}
              <span className="badge bg-secondary px-3 py-2 text-uppercase text-wrap lh-base" style={{ maxWidth: '100%' }}>
                <i className="bi bi-building me-1"></i>
                {orgName || department}
              </span>
            </div>

            {/* =================================================
                ERROR
            ================================================= */}
            {error && (
              <div
                className="alert alert-danger small"
                role="alert"
              >
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}

            {/* =================================================
                MESSAGE
            ================================================= */}
            {message && (
              <div
                className="alert alert-secondary bg-dark border-secondary text-light small"
                role="alert"
              >
                <i className="bi bi-info-circle-fill me-2"></i>
                {message}
              </div>
            )}

            {/* =================================================
                EMAIL STEP
            ================================================= */}
            {step === "email" && (
              <form onSubmit={handleSendOtp}>
                <p className="text-secondary small mb-3">
                  Enter your registered institutional email address.
                  A 6-digit verification code will be sent to your inbox.
                </p>

                <div className="mb-3">
                  <label className="form-label text-secondary small fw-semibold">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    className="form-control bg-card text-color border-secondary py-2"
                    placeholder="officer@filamer.edu.ph"
                    required
                    autoComplete="email"
                    disabled={loading}
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
                        aria-hidden="true"
                      />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-envelope-fill me-2"></i>
                      Send Verification Code
                    </>
                  )}
                </button>
              </form>
            )}

            {/* =================================================
                OTP STEP
            ================================================= */}
            {step === "code" && (
              <form onSubmit={handleVerifyOtp}>
                <div className="text-center mb-3">
                  <p className="text-secondary small mb-1">
                    We sent a verification code to:
                  </p>
                  <div className="text-info fw-bold">
                    {email}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label text-secondary small fw-semibold">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(e) => {
                      setCode(
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6)
                      );
                      setError("");
                    }}
                    className="form-control bg-card text-color border-secondary text-center fs-3 tracking-widest fw-bold py-2"
                    placeholder="000000"
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-success w-100 fw-bold py-2 mb-3 text-white"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-shield-check me-2"></i>
                      Verify & Sign In
                    </>
                  )}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    className="btn btn-link text-secondary text-decoration-none small"
                    onClick={resetLogin}
                    disabled={loading}
                  >
                    <i className="bi bi-arrow-left me-1"></i>
                    Use a different email
                  </button>
                </div>
              </form>
            )}
          </div> {/* End of modal-body */}
        </div>
      </div>
    </div>
  );
}