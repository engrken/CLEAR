// /app/department/[department]/Sidebar.tsx

"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react'; // 🚀 NEW: Import React hooks

const PRESET_ROLE_TABS: Record<string, string[]> = {
  admin: [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit', 
    'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report', 
    'tab-transfer', 'tab-users', 'tab-setup'
  ],
  treasurer: [
    'tab-overview', 'tab-clearance', 'tab-reports',
    'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances',
    'tab-collectibles', 'tab-report', 'tab-transfer'
  ],
  auditor: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'
  ],
  viewer: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'
  ]
};

export default function DepartmentSidebar({
  department,
  orgName,
  logoUrl,
  currentUser,
  defaultAy = 'A.Y. 2026 - 2027',
  defaultTerm = '1st Sem'
}: {
  department: string;
  orgName?: string; 
  logoUrl?: string | null;
  currentUser?: any;
  defaultAy?: string;
  defaultTerm?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 🚀 NEW: State to control mobile visibility
  const [isOpen, setIsOpen] = useState(false);

  // 🚀 NEW: Listen for the toggle event from TopHeader
  useEffect(() => {
    const toggleSidebar = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-sidebar', toggleSidebar);
    return () => window.removeEventListener('toggle-sidebar', toggleSidebar);
  }, []);

  // =========================================================
  // SECURE ROLE & ACCESS DERIVATION
  // =========================================================
  const rawRole = (currentUser?.role || 'viewer').toLowerCase();
  
  const normalizedRole = ['master', 'administrator', 'admin', 'superadmin'].includes(rawRole) 
    ? 'admin' 
    : rawRole;

  const isAdmin = normalizedRole === 'admin';

  const effectiveTabs = (currentUser?.allowedTabs && currentUser.allowedTabs.length > 0)
    ? currentUser.allowedTabs
    : (PRESET_ROLE_TABS[normalizedRole] || PRESET_ROLE_TABS.viewer);

  // =========================================================
  // PATH & FORMATTING
  // =========================================================
  const deptKey = department
    ? decodeURIComponent(department).toLowerCase().replace(/\s+/g, '')
    : 'engineering';

  const basePath = `/department/${encodeURIComponent(deptKey)}`;
  const ay = searchParams.get('ay') || 'A.Y. 2026 - 2027';
  const term = searchParams.get('term') || '1st Sem';
  const queryString = `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  const fallbackLogoPath = '/engineering_logo.png';
  const displayLogo = logoUrl || fallbackLogoPath;

  // =========================================================
  // ACTIVE LINK DETECTION
  // =========================================================
  const isActive = (path: string) => {
    const fullPath = `${basePath}${path}`;
    if (path === '') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  // 🚀 NEW: Close state nicely on navigation instead of manual class removal
  const handleNavClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 992) {
      setIsOpen(false); 
    }
  };

  const navItemClass = (path: string) => `
    list-group-item list-group-item-action rounded py-2 px-3 d-flex align-items-center text-decoration-none
    ${isActive(path) ? 'bg-info bg-opacity-10 text-info fw-bold border-start border-info border-4' : 'text-secondary'}
  `;

  const canAccess = (tabId: string) => {
    if (currentUser?.email === 'kent.bsece@gmail.com') return true;
    return effectiveTabs.includes(tabId);
  };

  return (
    <>
      {/* 📱 MOBILE FIX: Darkened backdrop that closes the sidebar when clicked */}
      {isOpen && (
        <div 
          className="d-lg-none"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040, transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* 📱 MOBILE FIX: Injecting necessary CSS for sliding behavior */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 991.98px) {
          #appSidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            z-index: 1045 !important;
            transform: translateX(-100%);
            background-color: var(--bs-body-bg) !important;
          }
          #appSidebar.show {
            transform: translateX(0);
            box-shadow: 4px 0 15px rgba(0,0,0,0.3);
          }
        }
      `}} />

      <nav
        id="appSidebar"
        className={`sidebar border-end border-secondary bg-card p-3 d-flex flex-column custom-scrollbar ${isOpen ? 'show' : ''}`}
        style={{ width: '280px', height: '100vh', position: 'sticky', top: 0, overflowY: 'auto', transition: 'transform 0.3s ease' }}
      >
        {/* HEADER */}
        <div className="d-flex align-items-center mb-4 px-2">
          <div style={{ width: '40px', flexShrink: 0 }} className="text-center me-2">
            <img
              src={displayLogo}
              alt={`${department} Logo`}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackLogoPath; }}
              style={{ width: '100%', maxHeight: '40px', objectFit: 'contain' }}
            />
          </div>
          
          <div>
            <h6 className="fw-bold mb-0 text-accent text-truncate">CLEAR System</h6>
            <small 
              className="text-secondary d-block mt-1" 
              style={{ 
                fontSize: '0.7rem', 
                textTransform: 'uppercase',
                lineHeight: '1.2' 
              }}
            >
              {orgName || department} 
            </small>
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="list-group list-group-flush gap-1 flex-grow-1" style={{ fontSize: '0.9rem' }}>
          <div className="text-uppercase text-secondary fw-bold px-2 py-1" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Core</div>
          {canAccess('tab-overview') && <Link href={`${basePath}${queryString}`} onClick={handleNavClick} className={navItemClass('')}><i className="bi bi-speedometer2 me-3 fs-6"></i>Overview</Link>}
          {canAccess('tab-clearance') && <Link href={`${basePath}/clearance${queryString}`} onClick={handleNavClick} className={navItemClass('/clearance')}><i className="bi bi-person-check me-3 fs-6"></i>Clearance</Link>}
          {canAccess('tab-students') && <Link href={`${basePath}/students${queryString}`} onClick={handleNavClick} className={navItemClass('/students')}><i className="bi bi-people me-3 fs-6"></i>Students Roster</Link>}

          {(canAccess('tab-payment') || canAccess('tab-remittances') || canAccess('tab-advances') || canAccess('tab-audit') || canAccess('tab-penalties') || canAccess('tab-collectibles')) && (
            <div className="text-uppercase text-secondary fw-bold px-2 pt-3 pb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Operations</div>
          )}
          {canAccess('tab-payment') && <Link href={`${basePath}/collections${queryString}`} onClick={handleNavClick} className={navItemClass('/collections')}><i className="bi bi-cash-stack me-3 fs-6"></i>Collections</Link>}
          {canAccess('tab-remittances') && <Link href={`${basePath}/remittances${queryString}`} onClick={handleNavClick} className={navItemClass('/remittances')}><i className="bi bi-upload me-3 fs-6"></i>Remittance Queue</Link>}
		  {canAccess('tab-payment') && <Link href={`${basePath}/cashier-remittance${queryString}`} onClick={handleNavClick} className={navItemClass('/cashier-remittance')}><i className="bi bi-safe2 me-3 fs-6"></i>Univ. Cashier Deposit</Link>}
          {canAccess('tab-advances') && <Link href={`${basePath}/advances${queryString}`} onClick={handleNavClick} className={navItemClass('/advances')}><i className="bi bi-journal-arrow-up me-3 fs-6"></i>Cash Advances</Link>}
          {canAccess('tab-audit') && <Link href={`${basePath}/liquidations${queryString}`} onClick={handleNavClick} className={navItemClass('/liquidations')}><i className="bi bi-receipt me-3 fs-6"></i>Liquidations</Link>}
          {canAccess('tab-penalties') && <Link href={`${basePath}/penalties${queryString}`} onClick={handleNavClick} className={navItemClass('/penalties')}><i className="bi bi-exclamation-octagon me-3 fs-6"></i>Penalties & Fines</Link>}
          {canAccess('tab-collectibles') && <Link href={`${basePath}/collectibles${queryString}`} onClick={handleNavClick} className={navItemClass('/collectibles')}><i className="bi bi-inbox me-3 fs-6"></i>Collectibles & Dues</Link>}

          {(canAccess('tab-reports') || canAccess('tab-report') || canAccess('tab-transfer')) && (
            <div className="text-uppercase text-secondary fw-bold px-2 pt-3 pb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Audit & Reporting</div>
          )}
          {canAccess('tab-reports') && <Link href={`${basePath}/reports${queryString}`} onClick={handleNavClick} className={navItemClass('/reports')}><i className="bi bi-bar-chart-line me-3 fs-6"></i>Detailed Reports</Link>}
          {canAccess('tab-report') && <Link href={`${basePath}/summary${queryString}`} onClick={handleNavClick} className={navItemClass('/summary')}><i className="bi bi-file-earmark-text me-3 fs-6"></i>Summary Report</Link>}
          {canAccess('tab-transfer') && <Link href={`${basePath}/realign${queryString}`} onClick={handleNavClick} className={navItemClass('/realign')}><i className="bi bi-arrow-left-right me-3 fs-6"></i>Realign Funds</Link>}

          {(canAccess('tab-void') || canAccess('tab-users') || canAccess('tab-setup') || isAdmin) && (
            <div className="text-uppercase text-secondary fw-bold px-2 pt-3 pb-1" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>Administration</div>
          )}
          {canAccess('tab-void') && <Link href={`${basePath}/void${queryString}`} onClick={handleNavClick} className={navItemClass('/void')}><i className="bi bi-slash-circle me-3 fs-6"></i>Void Center</Link>}
          {canAccess('tab-users') && <Link href={`${basePath}/users${queryString}`} onClick={handleNavClick} className={navItemClass('/users')}><i className="bi bi-person-gear me-3 fs-6"></i>User Management</Link>}
          {isAdmin && <Link href={`${basePath}/logs${queryString}`} onClick={handleNavClick} className={navItemClass('/logs')}><i className="bi bi-journal-text me-3 fs-6"></i>System Logs</Link>}
          {canAccess('tab-setup') && <Link href={`${basePath}/setup${queryString}`} onClick={handleNavClick} className={navItemClass('/setup')}><i className="bi bi-sliders me-3 fs-6"></i>System Setup</Link>}
        </div>
      </nav>
    </>
  );
}