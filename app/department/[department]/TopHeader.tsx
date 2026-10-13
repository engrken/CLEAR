"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, Suspense, useTransition } from 'react';
import { signOut } from "next-auth/react";
import LoginModal from './LoginModal'; 
import { updateMyEmail } from './actions';

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
  defaultTerm = '1st Sem' 
}: { 
  department: string; 
  currentUser?: any; 
  defaultAy?: string; 
  defaultTerm?: string; 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const ay = searchParams.get('ay') || defaultAy;
  const term = searchParams.get('term') || defaultTerm;

  const [theme, setTheme] = useState('dark');
  
  const isLoggedIn = !!currentUser;
  const userName = currentUser?.name || currentUser?.fullName || 'System Officer';
  const role = currentUser?.role || 'OFFICER';
  const username = currentUser?.username || 'N/A';
  const initialEmail = currentUser?.email || '';
  const allowedTabs = currentUser?.allowedTabs || [];
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editableEmail, setEditableEmail] = useState(initialEmail);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [fcuError, setFcuError] = useState(false);
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

  const fcuLogoPath = '/fcu.png';

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('fcu_clear_theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme);
  };

  const handleFilterChange = (newAy: string, newTerm: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('ay', newAy);
    params.set('term', newTerm);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      try {
        await signOut({ redirect: false });
        const cookiesToClear = ['fcu_session', 'fcu_otp_hash', 'fcu_otp_email', 'fcu_otp_strikes', 'fcu_lockout'];
        cookiesToClear.forEach(cookie => {
          document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
      } catch (e) {
        console.error("Logout failed", e);
      }
      
      alert("Signed out successfully.");
      window.location.reload();
    } else {
      setShowModal(true);
    }
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await updateMyEmail(department, editableEmail);
        if (res.success) {
          alert(res.message);
          setShowProfileModal(false);
          window.location.reload();
        }
      } catch (err: any) {
        alert(err.message || "Failed to update email.");
      }
    });
  };

  return (
    <>
      <header className="navbar navbar-expand border-bottom border-secondary px-4 py-3 bg-card shadow-sm flex-column align-items-stretch">
        <div className="d-flex align-items-center justify-content-between w-100">
          <div className="d-flex align-items-center gap-3">
            
            {/* 📱 MOBILE FIX: Uses a global event instead of direct DOM manipulation */}
            <button 
              className="btn btn-outline-secondary btn-sm d-lg-none" 
              type="button" 
              onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
            >
              <i className="bi bi-list fs-3"></i>
            </button>

            <div className="d-flex align-items-center gap-3">
              {/* 🖥️ DESKTOP VIEW: Show the actual logo */}
              {!fcuError ? (
                <div style={{ width: '96px', flexShrink: 0 }} className="text-center d-none d-md-block">
                  <img 
                    src={fcuLogoPath} 
                    alt="FCU Logo" 
                    onError={() => setFcuError(true)}
                    style={{ width: '100%', maxHeight: '96px', objectFit: 'contain' }} 
                  />
                </div>
              ) : (
                <div className="bg-accent text-dark rounded px-3 py-2 fw-bold d-none d-md-block" style={{ fontSize: '2.55rem' }}>
                  FCU
                </div>
              )}

              <div>
                {/* 🖥️ DESKTOP VIEW: Full spelled-out title */}
                <span className="text-secondary d-none d-md-inline" style={{ fontSize: '2.16rem', lineHeight: '1.2' }}>
                  <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords <b>System</b>
                </span>

                {/* 📱 MOBILE VIEW: Compact bold text instead of the large logo */}
                <span className="text-accent d-inline d-md-none fw-bold" style={{ fontSize: '1.35rem', letterSpacing: '0.5px' }}>
                  CLEAR System
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
              onChange={(e) => handleFilterChange(e.target.value, term)}
              style={{ width: '160px', fontSize: '0.82rem' }}
            >
              <option value="A.Y. 2026 - 2027">A.Y. 2026 - 2027</option>
              <option value="A.Y. 2027 - 2028">A.Y. 2027 - 2028</option>
              <option value="A.Y. 2028 - 2029">A.Y. 2028 - 2029</option>
              <option value="A.Y. 2029 - 2030">A.Y. 2029 - 2030</option>
            </select>

            <select 
              className="form-select form-select-sm bg-card text-color border-secondary"
              value={term}
              onChange={(e) => handleFilterChange(ay, e.target.value)}
              style={{ width: '110px', fontSize: '0.82rem' }}
            >
              <option value="1st Sem">1st Sem</option>
              <option value="2nd Sem">2nd Sem</option>
              <option value="Summer">Summer</option>
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

          <div>
            {isLoggedIn ? (
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
            ) : (
              <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1 text-uppercase fw-bold" style={{ fontSize: '0.75rem' }}>
                GUEST / PUBLIC
              </span>
            )}
          </div>

          <button 
            className={`btn btn-sm d-flex align-items-center gap-1 px-2 py-1 ${isLoggedIn ? 'btn-outline-danger' : 'btn-primary'}`} 
            onClick={handleAuthAction}
            title={isLoggedIn ? "Sign Out" : "Sign In"}
            style={{ fontSize: '0.8rem' }}
          >
            <i className={`bi ${isLoggedIn ? 'bi-box-arrow-right' : 'bi-shield-lock-fill'}`}></i>
            <span className="fw-bold">{isLoggedIn ? "Sign Out" : "Sign In"}</span>
          </button>
        </div>
      </header>

      {/* USER PROFILE MODAL */}
      {showProfileModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary shadow bg-card text-color">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent fw-bold">
                  <i className="bi bi-person-badge me-2"></i>Officer Profile Settings
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowProfileModal(false)}></button>
              </div>
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
defaultTerm?: string
}) {
  return (
    <Suspense fallback={<div className="p-3 bg-card border-bottom border-secondary">Loading header...</div>}>
      <TopHeaderContent {...props} />
    </Suspense>
  );
}