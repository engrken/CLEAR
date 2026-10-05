"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { requestOtp } from "../auth-actions";

export default function OtpModal({
  department,
}: {
  department: string;
}) {
  const [step, setStep] =
    useState<"email" | "code">("email");

  const [email, setEmail] =
    useState("");

  const [code, setCode] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [devNotice, setDevNotice] =
    useState("");

  // =========================================================
  // SEND OTP
  // =========================================================

  const handleSendOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setLoading(true);
    setDevNotice("");

    try {
      const cleanEmail = email.trim().toLowerCase();

      const result = await requestOtp(
        department,
        cleanEmail
      );

      if (result.success) {
        setDevNotice(result.message);
        setStep("code");
      }
    } catch (error) {
      console.error("OTP request error:", error);

      alert(
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

  if (code.length !== 6) {
    alert("Please enter the complete 6-digit verification code.");
    return;
  }

  setLoading(true);

  try {
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      department: decodeURIComponent(department)
        .trim()
        .toLowerCase(),
      redirect: false,
    });

    console.log("NextAuth signIn result:", result);

    if (!result) {
      alert("No response was received from the authentication server.");
      return;
    }

    if (result.error) {
      console.error("NextAuth authentication error:", result.error);

      alert(
        result.error === "CredentialsSignin"
          ? "The verification code was rejected. Please check that you entered the latest OTP correctly."
          : result.error
      );

      return;
    }

    // Successful authentication
    window.location.href =
      `/department/${encodeURIComponent(
        decodeURIComponent(department).trim().toLowerCase()
      )}/summary`;

  } catch (error) {
    console.error("OTP verification error:", error);

    alert(
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

        <div className="modal-content bg-card border-secondary text-color p-4 shadow-lg">

          {/* HEADER */}

          <div className="d-flex justify-content-between align-items-center mb-3">

            <h5 className="modal-title text-accent fw-bold">

              <i className="bi bi-shield-lock-fill me-2"></i>

              Departmental Authorization

            </h5>

            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="modal"
              aria-label="Close"
            />

          </div>

          {/* DEPARTMENT */}

          <div className="text-center mb-3">

            <span className="badge bg-secondary">

              <i className="bi bi-building me-1"></i>

              {department}

            </span>

          </div>

          {/* =================================================
              EMAIL STEP
          ================================================= */}

          {step === "email" ? (

            <form onSubmit={handleSendOtp}>

              <p className="text-secondary small mb-3">

                Enter your registered institutional
                email address. A 6-digit verification
                code will be dispatched to your inbox.

              </p>

              <div className="mb-3">

                <label className="form-label text-secondary small fw-semibold">

                  Email Address

                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
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

                {loading
                  ? "Sending Code..."
                  : "Send Verification Code"}

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
                    setCode(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
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
                disabled={
                  loading ||
                  code.length !== 6
                }
              >

                {loading
                  ? "Verifying..."
                  : "Verify & Sign In"}

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