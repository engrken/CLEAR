// /app/department/[department]/components/OtpModal.tsx


"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState } from "react";
import { signIn } from "next-auth/react";
import { requestOtp } from "../auth-actions";

export default function OtpModal({
  department,
  orgName,
  orgType, // <-- NEW: Accept the entity type
}: {
  department: string;
  orgName?: string;
  orgType?: string; // <-- NEW
}) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devNotice, setDevNotice] = useState("");

  // =========================================================
  // SEND OTP
  // =========================================================
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDevNotice("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = await requestOtp(department, cleanEmail);

      if (result.success) {
        setDevNotice(result.message);
        setStep("code");
      }
    } catch (error) {
      console.error("OTP request error:", error);
      void clearAlert(
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
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6) {
      void clearAlert("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
      
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        department: cleanDepartment,
        redirect: false,
      });

      // Do not log authentication results to the browser console.

      if (!result) {
        void clearAlert("No response was received from the authentication server.");
        return;
      }

      if (result.error) {
        console.error("NextAuth authentication error:", result.error);
        void clearAlert(
          result.error === "CredentialsSignin"
            ? "The verification code was rejected. Please check that you entered the latest OTP correctly."
            : result.error
        );
        return;
      }

      // =========================================================
      // SUCCESSFUL AUTHENTICATION
      // =========================================================
      window.location.href = `/department/${encodeURIComponent(cleanDepartment)}`;

    } catch (error) {
      console.error("OTP verification error:", error);
      void clearAlert(
        error instanceof Error
          ? error.message
          : "Verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RESET LOGIN
  // =========================================================
  const resetLogin = () => {
    setStep("email");
    setCode("");
    setDevNotice("");
  };

  // =========================================================
  // UI
  // =========================================================
  return (
    <div
      className="modal fade"
      id="otpAuthModal"
      tabIndex={-1}
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-card border-secondary text-color p-4 shadow-lg clear-theme-modal">
          
          {/* HEADER */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="modal-title text-accent fw-bold">
              <i className="bi bi-shield-lock-fill me-2"></i>
              {/* DYNAMIC HEADER TITLE */}
              {orgType ? `${orgType} Portal` : "Secure Authorization"}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Close"
            />
          </div>

          {/* BADGE */}
          <div className="text-center mb-3">
            <span className="badge bg-secondary px-3 py-2 text-uppercase text-wrap lh-base" style={{ maxWidth: '100%' }}>
              <i className={`me-1 ${orgType === 'Organization' ? 'bi bi-people-fill' : 'bi bi-building'}`}></i>
              {orgName || department}
            </span>
          </div>

          {/* =================================================
              EMAIL STEP
          ================================================= */}
          {step === "email" ? (
            <form onSubmit={handleSendOtp}>
              <p className="text-secondary small mb-3">
                Enter your registered institutional email address. A 6-digit verification code will be dispatched to your inbox.
              </p>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control bg-card text-color border-secondary py-2"
                  placeholder="officer@domain.edu.ph"
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="btn btn-info w-100 fw-bold py-2 text-dark"
                disabled={loading}
              >
                {loading ? "Sending Code..." : "Send Verification Code"}
              </button>
            </form>
          ) : (
            /* =================================================
               CODE STEP
            ================================================= */
            <form onSubmit={handleVerifyOtp}>
              <div className="mb-3 text-center">
                <p className="text-secondary small mb-1">
                  We sent a verification code to:
                </p>
                <span className="text-info fw-bold fs-6">
                  {email}
                </span>
              </div>

              {/* SERVER MESSAGE */}
              {devNotice && (
                <div className="alert alert-secondary bg-dark border-secondary text-light small py-2 px-3 mb-3 text-center">
                  {devNotice}
                </div>
              )}

              {/* OTP INPUT */}
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
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="form-control bg-card text-color border-secondary text-center fs-3 tracking-widest fw-bold py-2"
                  placeholder="000000"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              {/* VERIFY BUTTON */}
              <button
                type="submit"
                className="btn btn-success w-100 fw-bold py-2 mb-3 text-white"
                disabled={loading || code.length !== 6}
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
              </button>

              {/* RESET */}
              <div className="text-center">
                <button
                  type="button"
                  className="btn btn-link text-secondary text-decoration-none small p-0"
                  onClick={resetLogin}
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