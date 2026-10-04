"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { requestOtp, verifyOtp } from './actions';

export default function TopHeader({ department, currentUser }: { department: string; currentUser?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const ay = searchParams.get('ay') || 'A.Y. 2026 - 2027';
  const term = searchParams.get('term') || '1st Sem';

  const [theme, setTheme] = useState('dark');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState(currentUser?.fullName || 'Department Officer');
  const [role, setRole] = useState(currentUser?.role || 'OFFICER');
  
  // Login Modal State
  const [showModal, setShowModal] = useState(false);
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [authEmail, setAuthEmail] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [fcuError, setFcuError] = useState(false);

  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    setTheme(currentTheme);
    
    const storedUser = localStorage.getItem('fcu_clear_user');
    if (currentUser || storedUser) {
      setIsLoggedIn(true);
      if (!currentUser && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUserName(parsed.fullName);
          setRole(parsed.role);
        } catch (e) {
          setUserName(storedUser);
        }
      }
    }
  }, [currentUser]);

  // Clean absolute path for production/migration
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

  const handleAuthAction = () => {
    if (isLoggedIn) {
      try {
        localStorage.removeItem('fcu_clear_user');
        localStorage.removeItem('fcu_clear_token');
        
        document.cookie = "fcu_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "fcu_otp_hash=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "fcu_otp_email=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "fcu_otp_strikes=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "fcu_lockout=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        setIsLoggedIn(false);
      } catch (e) {
        // Fallback catch
      }
      
      alert("Signed out successfully.");
      window.location.reload();
    } else {
      setAuthStep('email');
      setAuthEmail('');
      setAuthOtp('');
      setAuthError(null);
      setShowModal(true);
    }
  };

  const submitEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail) return setAuthError("Please enter your institutional email.");
    setAuthLoading(true);
    setAuthError(null);
    try {
      await requestOtp(department, authEmail);
      setAuthStep('otp');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const submitOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authOtp || authOtp.length !== 6) return setAuthError("Please enter a valid 6-digit code.");
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await verifyOtp(department, authEmail, authOtp);
      if (res.success) {
        localStorage.setItem('fcu_clear_user', JSON.stringify(res.user));
        setShowModal(false);
        setTimeout(() => {
           window.location.reload();
        }, 200);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <>
      <header className="navbar navbar-expand border-bottom border-secondary px-4 py-3 bg-card shadow-sm flex-column align-items-stretch">
        
        {/* Top Row: Brand Header & Mobile Toggle */}
        <div className="d-flex align-items-center justify-content-between w-100">
          <div className="d-flex align-items-center gap-3">
            <button 
              className="btn btn-outline-secondary btn-sm d-lg-none" 
              type="button" 
              onClick={() => document.getElementById('appSidebar')?.classList.toggle('show')}
            >
              <i className="bi bi-list fs-3"></i>
            </button>

            <div className="d-flex align-items-center gap-3">
              {!fcuError ? (
                <div style={{ width: '96px', flexShrink: 0 }} className="text-center">
                  <img 
                    src={fcuLogoPath} 
                    alt="FCU Logo" 
                    onError={() => setFcuError(true)}
                    style={{ width: '100%', maxHeight: '96px', objectFit: 'contain' }} 
                  />
                </div>
              ) : (
                <div className="bg-accent text-dark rounded px-3 py-2 fw-bold" style={{ fontSize: '2.55rem' }}>
                  FCU
                </div>
              )}

              <div>
                <h6 className="fw-bold mb-0 text-accent" style={{ fontSize: '2.7rem', letterSpacing: '0.01em', lineHeight: '1.2' }}>
                  CLEAR System
                </h6>
                <span className="text-secondary d-none d-md-inline" style={{ fontSize: '2.16rem', lineHeight: '1.2' }}>
                  <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords System
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Filters, Theme, Badge, and Auth Button */}
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
              <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1 text-uppercase fw-bold" style={{ fontSize: '0.75rem' }} title={userName}>
                {role}
              </span>
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

      {/* Embedded Departmental Authorization Modal */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1055 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary shadow-lg bg-card text-color">
              
              <div className="modal-header border-secondary">
                <h5 className="modal-title d-flex align-items-center fw-bold">
                  <i className="bi bi-shield-lock-fill text-primary me-2 fs-4"></i>
                  Departmental Authorization
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <div className="modal-body p-4">
                {authError && (
                  <div className="alert alert-danger py-2 small mb-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{authError}
                  </div>
                )}

                {authStep === 'email' ? (
                  <form onSubmit={submitEmailRequest}>
                    <p className="text-secondary small mb-3">
                      Enter your registered institutional email address. A 6-digit verification code will be dispatched to your inbox.
                    </p>
                    <div className="mb-3">
                      <label className="form-label text-secondary small fw-semibold">Email Address</label>
                      <input 
                        type="email" 
                        className="form-control bg-card text-color border-secondary" 
                        placeholder="officer@domain.edu.ph" 
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required 
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={authLoading}>
                      {authLoading ? 'Sending Code...' : 'Send Verification Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitOtpVerify}>
                    <p className="text-secondary small mb-1">We sent a verification code to:</p>
                    <div className="fw-bold text-accent mb-3">{authEmail}</div>
                    
                    <div className="mb-3">
                      <label className="form-label text-secondary small fw-semibold">Enter 6-Digit Code</label>
                      <input 
                        type="text" 
                        className="form-control bg-card text-color border-secondary text-center fs-4 font-monospace py-2" 
                        maxLength={6} 
                        placeholder="000000" 
                        value={authOtp}
                        onChange={(e) => setAuthOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        required 
                        autoFocus
                      />
                    </div>
                    
                    <div className="d-grid gap-2">
                      <button type="submit" className="btn btn-success fw-bold" disabled={authLoading}>
                        {authLoading ? 'Verifying...' : 'Verify & Sign In'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-link btn-sm text-secondary text-decoration-none mt-1" 
                        onClick={() => { setAuthStep('email'); setAuthOtp(''); setAuthError(null); }}
                        disabled={authLoading}
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
      )}
    </>
  );
}