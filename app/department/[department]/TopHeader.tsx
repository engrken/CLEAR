// /app/department/[department]/TopHeader.tsx

"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, Suspense, useTransition } from 'react';
import { signOut } from "next-auth/react";
import { configurationForYear, periodsFor, type CalendarByYear } from "@/lib/academic-periods";
import LoginModal from './LoginModal'; 
import { updateMyEmail } from './actions';
import DepartmentPresenceAndTour from './components/DepartmentPresenceAndTour';
import { ThemedAlert } from '@/lib/clear-dialogs'; // 🚀 Fixed F11: Theme-adaptive SweetAlerts

const MODULE_LABELS: Record<string, string> = {
  'tab-overview': 'Overview',
  'tab-students': 'Students Roster',
  'tab-clearance': 'Clearance',
  'tab-payment': 'Collections',
  'tab-remittances': 'Remittance Queue',
  'tab-penalties': 'Penalties',
  'tab-advances': 'Cash Advances',
  'tab-audit': 'Liquidations',
  'tab-collectibles': 'Collectibles',
  'tab-reports': 'Detailed Reports',
  'tab-void': 'Void Center',
  'tab-report': 'Summary Report',
  'tab-transfer': 'Realign Funds',
  'tab-users': 'User Management',
  'tab-setup': 'System Setup'
};

function TopHeaderContent({ 
  department, 
  currentUser, 
  defaultAy = 'A.Y. 2026 - 2027', 
  defaultTerm = '1st Sem',
  calendarConfigs = {},
}: { 
  department: string; 
  currentUser?: any; 
  defaultAy?: string; 
  defaultTerm?: string;
  calendarConfigs?: CalendarByYear;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const ay = searchParams.get('ay') || defaultAy;
  const selectedAy = searchParams.get('ay') || defaultAy;
  const terms = periodsFor(configurationForYear(selectedAy, calendarConfigs));
  const requestedTerm = searchParams.get('term') || (selectedAy === defaultAy ? defaultTerm : '');
  const term = terms.includes(requestedTerm) ? requestedTerm : terms[0];
  // Old bookmarked URLs may contain a term from a different calendar; normalize it.
  useEffect(() => {
    const incoming = searchParams.get('term');
    if (incoming && !terms.includes(incoming)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('term', term);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router, terms.join('|'), term]);

  const [theme, setTheme] = useState('dark');
  const yearChoices = Array.from(new Set([
    defaultAy, ay, ...Array.from({ length: 9 }, (_, offset) => {
      const start = 2024 + offset;
      return `A.Y. ${start} - ${start + 1}`;
    }),
  ])).filter(Boolean);
  
  const isLoggedIn = !!currentUser;
  const userName = currentUser?.name || currentUser?.fullName || 'System Officer';
  const role = currentUser?.role || 'OFFICER';
  const username = currentUser?.username || 'N/A'; // 🚀 Fixed F40: Correctly maps username
  const initialEmail = currentUser?.email || '';
  const allowedTabs = currentUser?.allowedTabs || [];
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editableEmail, setEditableEmail] = useState(initialEmail);
  useEffect(() => setEditableEmail(initialEmail), [initialEmail]);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [clearsysError, setclearsysError] = useState(false);
  const [showForbidden, setShowForbidden] = useState(false);

  useEffect(() => {
    const loginParam = searchParams.get('login');
    const forbiddenParam = searchParams.get('forbidden');
    
    let shouldCleanUrl = false;
    const params = new URLSearchParams(searchParams.toString());

    if (loginParam === 'true') {
      setShowModal(true);
      params.delete('login');
      shouldCleanUrl = true;
    }

    if (forbiddenParam === 'true') {
      setShowForbidden(true);
      setTimeout(() => setShowForbidden(false), 5000); 
      params.delete('forbidden');
      shouldCleanUrl = true;
    }

    if (shouldCleanUrl) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    setTheme(currentTheme);
  }, []);

  const clearsysLogoPath = '/clearsys.png';

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('clearsys_clear_theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme);
  };

  const handleFilterChange = (newAy: string, newTerm: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('ay', newAy);
    params.set('term', newTerm);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleAuthAction = async () => {
    if (!isLoggedIn) { setShowModal(true); return; }
    try {
      await signOut({ callbackUrl: `/department/${encodeURIComponent(department)}?login=true` });
    } catch (error) {
      await ThemedAlert.fire({ icon: 'error', title: 'Sign Out Failed', text: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await updateMyEmail(department, editableEmail);
        if (res.success) {
          await ThemedAlert.fire({
            icon: 'success',
            title: 'Success',
            text: res.message || 'Email updated successfully.',
          });
          setShowProfileModal(false);
          // The old NextAuth session contains the previous email. Re-authenticate via OTP.
          await signOut({ callbackUrl: `/department/${encodeURIComponent(department)}?login=true` });
        }
      } catch (err: any) {
        ThemedAlert.fire({
          icon: 'error',
          title: 'Update Failed',
          text: err.message || "Failed to update email.",
        });
      }
    });
  };

  return (
    <>
      <header className="navbar navbar-expand border-bottom border-secondary px-4 py-3 bg-card shadow-sm flex-column align-items-stretch">
        <div className="d-flex align-items-center justify-content-between w-100">
          <div className="d-flex align-items-center gap-3">
            
            <button 
              className="btn btn-outline-secondary btn-sm d-lg-none" 
              type="button" 
              onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
            >
              <i className="bi bi-list fs-3"></i>
            </button>

            <div className="d-flex align-items-center gap-3">
              {!clearsysError ? (
                <div style={{ width: '96px', flexShrink: 0 }} className="text-center d-none d-md-block">
                  <img 
                    src={clearsysLogoPath} 
                    alt="clearsys Logo" 
                    onError={() => setclearsysError(true)}
                    style={{ width: '100%', maxHeight: '96px', objectFit: 'contain' }} 
                  />
                </div>
              ) : (
                <div className="bg-accent text-dark rounded px-3 py-2 fw-bold d-none d-md-block" style={{ fontSize: '2.55rem' }}>
                  clearsys
                </div>
              )}

              <div>
                <span className="text-secondary d-none d-md-inline" style={{ fontSize: '2.16rem', lineHeight: '1.2' }}>
                  <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords <b>System</b>
                </span>

                <span className="text-accent d-inline d-md-none fw-bold" style={{ fontSize: '1.25rem', letterSpacing: '0.5px' }}>
                  <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords <b>System</b>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-end flex-wrap gap-3 mt-3 pt-2 border-top border-secondary border-opacity-25 w-100">
          <div className="d-flex align-items-center gap-2">
            <select 
              className="form-select form-select-sm bg-card text-color border-secondary"
              value={ay}
              onChange={(e) => { const nextAy = e.target.value; const allowed = periodsFor(configurationForYear(nextAy, calendarConfigs)); handleFilterChange(nextAy, allowed.includes(term) ? term : allowed[0]); }}
              style={{ width: '160px', fontSize: '0.82rem' }}
            >
              {yearChoices.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>

            <select 
              className="form-select form-select-sm bg-card text-color border-secondary"
              value={term}
              onChange={(e) => handleFilterChange(ay, e.target.value)}
              style={{ width: '110px', fontSize: '0.82rem' }}
            >
              {terms.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <button 
            className="btn btn-outline-secondary btn-sm rounded-circle d-flex align-items-center justify-content-center" 
            style={{ width: '32px', height: '32px' }}
            onClick={toggleTheme}
            title="Toggle Theme"
          >
            <i className={`bi ${theme === 'light' ? 'bi-moon-fill' : 'bi-sun-fill'}`} style={{ fontSize: '0.85rem' }}></i>
          </button>

          <DepartmentPresenceAndTour department={department} currentUser={currentUser} ay={ay} term={term} pathname={pathname} />
          <div>
            {/* 🚀 Fixed F36: Removed unreachable unauthenticated fallback since layout guards protected routes */}
            <div 
              className="d-flex align-items-center border border-info border-opacity-25 rounded bg-info bg-opacity-10 px-2 py-1 shadow-sm transition-all"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowProfileModal(true)}
              title="Click to view and edit profile"
            >
              <i className="bi bi-person-circle text-info me-2"></i>
              <span className="text-info fw-bold me-2" style={{ fontSize: '0.8rem' }}>
                {userName}
              </span>
              <span className="badge bg-info text-dark text-uppercase" style={{ fontSize: '0.65rem' }}>
                {role}
              </span>
            </div>
          </div>

          <button 
            className="btn btn-sm d-flex align-items-center gap-1 px-2 py-1 btn-outline-danger" 
            onClick={handleAuthAction}
            title="Sign Out"
            style={{ fontSize: '0.8rem' }}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span className="fw-bold">Sign Out</span>
          </button>
        </div>
      </header>

      {/* USER PROFILE MODAL */}
      {showProfileModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary shadow bg-card text-color clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent fw-bold">
                  <i className="bi bi-person-badge me-2"></i>Officer Profile Settings
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowProfileModal(false)}></button>
              </div>
              <div className="px-4 pt-3"><a className="btn btn-outline-info btn-sm" href={`/department/${encodeURIComponent(department)}/email-preferences`}><i className="bi bi-envelope-check me-2"/>Transaction Email Preferences</a></div>
              <form onSubmit={handleSaveEmail}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">Full Name</label>
                    <input type="text" className="form-control bg-card text-color border-secondary" value={userName} disabled />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">Username</label>
                      <input type="text" className="form-control bg-card text-color border-secondary font-monospace" value={username} disabled />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-secondary small fw-semibold">System Role</label>
                      <input type="text" className="form-control bg-card text-color border-secondary text-uppercase fw-bold" value={role} disabled />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label text-secondary small fw-semibold">
                      Email Address <span className="text-info">(Editable)</span>
                    </label>
                    <input 
                      type="email" 
                      className="form-control bg-card text-color border-secondary" 
                      value={editableEmail} 
                      onChange={(e) => setEditableEmail(e.target.value)} 
                      required 
                    />
                    <small className="text-secondary d-block mt-1">Make sure this email is valid for receiving notifications and OTP codes.</small>
                  </div>

                  <div className="mb-2">
                    <label className="form-label text-secondary small fw-bold">Granted Module Permissions ({allowedTabs.length})</label>
                    <div className="border border-secondary rounded p-2 bg-surface" style={{ maxHeight: '130px', overflowY: 'auto' }}>
                      {allowedTabs.length > 0 ? (
                        <div className="d-flex flex-wrap gap-1">
                          {allowedTabs.map((tabId: string) => (
                            <span key={tabId} className="badge bg-secondary-subtle text-info border border-secondary" style={{ fontSize: '0.7rem' }}>
                              {MODULE_LABELS[tabId] || tabId}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="small text-secondary fst-italic">No custom tab permissions assigned.</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-secondary">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowProfileModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-info btn-sm fw-bold px-4 text-dark" disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showForbidden && (
        <div 
          className="alert alert-danger alert-dismissible fade show shadow-sm" 
          role="alert" 
          style={{ position: "fixed", top: "20px", right: "20px", zIndex: 1060 }}
        >
          <i className="bi bi-shield-lock-fill me-2"></i>
          <strong>Access Denied:</strong> You lack permission for this module.
          <button type="button" className="btn-close" onClick={() => setShowForbidden(false)} aria-label="Close"></button>
        </div>
      )}

      <LoginModal 
        show={showModal} 
        onClose={() => setShowModal(false)} 
        department={department} 
      />
    </>
  );
}

export default function TopHeader(props: { 
department: string;
currentUser?: any;
defaultAy?: string;
defaultTerm?: string;
calendarConfigs?: CalendarByYear;
}) {
  return (
    <Suspense fallback={<div className="p-3 bg-card border-bottom border-secondary">Loading header...</div>}>
      <TopHeaderContent {...props} />
    </Suspense>
  );
}