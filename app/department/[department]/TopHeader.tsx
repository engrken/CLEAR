"use client";

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import LoginModal from './LoginModal'; 
// import { logoutAction } from './auth-actions'; 

// We wrap the main header logic in a component that consumes useSearchParams
// so we can wrap it in Suspense below (a Next.js best practice for client boundary params)
function TopHeaderContent({ department, currentUser }: { department: string; currentUser?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const ay = searchParams.get('ay') || 'A.Y. 2026 - 2027';
  const term = searchParams.get('term') || '1st Sem';

  const [theme, setTheme] = useState('dark');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState(currentUser?.fullName || 'Department Officer');
  const [role, setRole] = useState(currentUser?.role || 'OFFICER');
  
  // Modal & Trigger State
  const [showModal, setShowModal] = useState(false);
  const [fcuError, setFcuError] = useState(false);
  const [showForbidden, setShowForbidden] = useState(false);

  // =========================================================
  // AUTHENTICATION TRIGGERS & URL CLEANUP
  // =========================================================
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
      setTimeout(() => setShowForbidden(false), 5000); // Auto-hide after 5s
      params.delete('forbidden');
      shouldCleanUrl = true;
    }

    if (shouldCleanUrl) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, pathname, router]);

  // =========================================================
  // STANDARD INITIALIZATION
  // =========================================================
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
          setUserName('Department Officer');
        }
      }
    }
  }, [currentUser]);

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
        localStorage.removeItem('fcu_clear_user');
        localStorage.removeItem('fcu_clear_token');
        
        const cookiesToClear = ['fcu_session', 'fcu_otp_hash', 'fcu_otp_email', 'fcu_otp_strikes', 'fcu_lockout'];
        cookiesToClear.forEach(cookie => {
          document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
        
        setIsLoggedIn(false);
      } catch (e) {
        console.error("Logout failed", e);
      }
      
      alert("Signed out successfully.");
      window.location.reload();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <header className="navbar navbar-expand border-bottom border-secondary px-4 py-3 bg-card shadow-sm flex-column align-items-stretch">
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
                <span className="text-secondary d-none d-md-inline" style={{ fontSize: '2.16rem', lineHeight: '1.2' }}>
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

      {/* 1. Forbidden Access Alert */}
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

      {/* 2. Login Modal Component */}
      <LoginModal 
        show={showModal} 
        onClose={() => setShowModal(false)} 
        department={department} 
      />
    </>
  );
}

// Wrap in Suspense to prevent entire page from opting into client-side rendering during build
export default function TopHeader(props: { department: string; currentUser?: any }) {
  return (
    <Suspense fallback={<div className="p-3 bg-card border-bottom border-secondary">Loading header...</div>}>
      <TopHeaderContent {...props} />
    </Suspense>
  );
}