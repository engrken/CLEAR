'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    title: 'Welcome to your clearance guide',
    detail: 'Check your own clearance status for the department and current academic period shown on this page. You do not need an officer account.',
  },
  {
    title: 'Enter your registered details',
    detail: 'Enter your Student ID and the email address registered in your department student record, then choose Send verification code. The request does not reveal whether an account exists.',
  },
  {
    title: 'Verify your email',
    detail: 'Enter the six-digit code sent to your registered email. The code expires after five minutes. Never share it with anyone, including someone claiming to be an officer.',
  },
  {
    title: 'Understand your clearance status',
    detail: 'CLEARED means your clearance is complete for the displayed period. CLEARANCE ON HOLD means an authorized officer can explain the outstanding requirements. NOT ENROLLED THIS TERM is not a clearance approval. This student view never shows itemized balances or other students’ records.',
  },
  {
    title: 'Finish securely',
    detail: 'Choose Finish private inquiry after viewing your result, especially on a shared device. The result also disappears after about two minutes or when you switch tabs. If you cannot access your registered email, contact your department administrator.',
  },
] as const;

/**
 * Anonymous, display-only guidance. Completion is a per-browser/per-department
 * UI preference, not student identity, privacy consent or clearance authority.
 */
export default function StudentClearanceGuide({ department }: { department: string }) {
  const storageKey = 'clear_student_clearance_guide_v1:' + department;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only poll while the separate privacy notice is pending. Once the
    // preference is known, stop polling rather than waking the clearance
    // page every second for the lifetime of the browser session.
    let timer: ReturnType<typeof setInterval> | null = null;
    const check = (): boolean => {
      try {
        if (window.localStorage.getItem(storageKey) === 'true') return true;
        if (window.localStorage.getItem('clear_privacy_accepted') === 'true') {
          // Acknowledgement is distinct from identity/OTP authorization.
          setStep(0);
          setOpen(true);
          return true;
        }
        return false;
      } catch {
        // A blocked preference write must not block manual replay.
        return true;
      }
    };
    if (!check()) {
      timer = window.setInterval(() => {
        if (check() && timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      }, 1000);
    }
    return () => {
      if (timer !== null) window.clearInterval(timer);
    };
  }, [storageKey]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, 'true');
    } catch {
      // A blocked preference write never prevents closing the guide.
    }
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, dismiss]);

  return (
    <>
      <div className="d-flex justify-content-end mb-3 d-print-none">
        <button type="button" className="btn btn-outline-info btn-sm"
          aria-haspopup="dialog" aria-expanded={open} onClick={() => { setStep(0); setOpen(true); }}>
          <i className="bi bi-question-circle me-1" aria-hidden="true" />
          How to check my clearance
        </button>
      </div>
      {open && (
        <div className="modal fade show d-block d-print-none" role="presentation"
          style={{ background: 'rgba(0,0,0,0.76)', zIndex: 1090 }}>
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
            <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"
              aria-labelledby="student-guide-title" aria-describedby="student-guide-detail"
              className="modal-content bg-body text-body border-info shadow-lg">
              <div className="modal-header">
                <h2 id="student-guide-title" className="modal-title h5 fw-bold" aria-live="polite">
                  {STEPS[step].title}
                </h2>
              </div>
              <div className="modal-body">
                <p id="student-guide-detail">{STEPS[step].detail}</p>
                <p className="small text-muted mb-0">Step {step + 1} of {STEPS.length}</p>
              </div>
              <div className="modal-footer d-flex justify-content-between gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm"
                  onClick={dismiss}>Skip guide</button>
                <div className="d-flex gap-2">
                  {step > 0 && (
                    <button type="button" className="btn btn-outline-secondary btn-sm"
                      onClick={() => setStep(value => value - 1)}>Back</button>
                  )}
                  <button type="button" className="btn btn-info btn-sm fw-bold"
                    onClick={() => step === STEPS.length - 1 ? dismiss() : setStep(value => value + 1)}>
                    {step === STEPS.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
