"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DepartmentSidebar({
  department,
  currentUser,
}: {
  department: string;
  currentUser?: any;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [allowedTabs, setAllowedTabs] = useState<string[]>(
    currentUser?.allowedTabs || ['tab-overview', 'tab-clearance']
  );

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      const stored = localStorage.getItem('fcu_clear_user');

      if (stored) {
        try {
          const parsed = JSON.parse(stored);

          if (parsed.allowedTabs) {
            setAllowedTabs(parsed.allowedTabs);
          }

          if (
            ['admin', 'administrator', 'master'].includes(
              parsed.role?.toLowerCase()
            )
          ) {
            setIsAdmin(true);
          }
        } catch (e) {
          // Ignore parse error
        }
      }
    } else {
      setAllowedTabs(currentUser.allowedTabs || []);

      setIsAdmin(
        ['admin', 'administrator', 'master'].includes(
          currentUser.role?.toLowerCase()
        )
      );
    }
  }, [currentUser]);

  // =========================================================
  // DEPARTMENT PATH
  // =========================================================

  const deptKey = department
    ? decodeURIComponent(department).toLowerCase().replace(/\s+/g, '')
    : 'engineering';

  /*
   * Every sidebar link will now use:
   *
   * /department/[department]/...
   *
   * Example:
   * /department/engineering/clearance
   */
  const basePath = `/department/${encodeURIComponent(deptKey)}`;

  // =========================================================
  // ACADEMIC YEAR / TERM
  // =========================================================

  const ay = searchParams.get('ay') || 'A.Y. 2026 - 2027';
  const term = searchParams.get('term') || '1st Sem';

  const queryString =
    `?ay=${encodeURIComponent(ay)}` +
    `&term=${encodeURIComponent(term)}`;

  // =========================================================
  // LOGO
  // =========================================================

  const logoPath = `/${deptKey}_logo.png`;
  const fallbackLogoPath = '/engineering_logo.png';

  // =========================================================
  // ACTIVE LINK DETECTION
  // =========================================================

  const isActive = (path: string) => {
    const fullPath = `${basePath}${path}`;

    if (path === '') {
      return (
        pathname === basePath ||
        pathname === `${basePath}/`
      );
    }

    return (
      pathname === fullPath ||
      pathname.startsWith(`${fullPath}/`)
    );
  };

  // =========================================================
  // MOBILE SIDEBAR
  // =========================================================

  const handleNavClick = () => {
    if (
      typeof window !== 'undefined' &&
      window.innerWidth < 992
    ) {
      const sidebar = document.getElementById('appSidebar');

      if (sidebar) {
        sidebar.classList.remove('show');
      }
    }
  };

  // =========================================================
  // NAVIGATION STYLE
  // =========================================================

  const navItemClass = (path: string) => `
    list-group-item list-group-item-action rounded py-2 px-3 d-flex align-items-center text-decoration-none
    ${
      isActive(path)
        ? 'bg-info bg-opacity-10 text-info fw-bold border-start border-info border-4'
        : 'text-secondary'
    }
  `;

  // =========================================================
  // ACCESS CONTROL
  // =========================================================

  const canAccess = (tabId: string) => {
    if (isAdmin) return true;

    return allowedTabs.includes(tabId);
  };

  return (
    <nav
      id="appSidebar"
      className="sidebar border-end border-secondary bg-card p-3 d-flex flex-column custom-scrollbar"
      style={{
        width: '280px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflowY: 'auto',
        transition: 'all 0.3s ease',
      }}
    >

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="d-flex align-items-center mb-4 px-2">

        <div
          style={{
            width: '40px',
            flexShrink: 0,
          }}
          className="text-center me-2"
        >
          <img
            src={logoPath}
            alt={`${department} Logo`}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = fallbackLogoPath;
            }}
            style={{
              width: '100%',
              maxHeight: '40px',
              objectFit: 'contain',
            }}
          />
        </div>

        <div className="overflow-hidden">
          <h6 className="fw-bold mb-0 text-accent text-truncate">
            CLEAR System
          </h6>

          <small
            className="text-secondary text-truncate d-block"
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
            }}
          >
            COLLEGE OF {department}
          </small>
        </div>

      </div>

      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <div
        className="list-group list-group-flush gap-1 flex-grow-1"
        style={{ fontSize: '0.9rem' }}
      >

        {/* ===================================================
            CORE
        ==================================================== */}

        <div
          className="text-uppercase text-secondary fw-bold px-2 py-1"
          style={{
            fontSize: '0.65rem',
            letterSpacing: '0.05em',
          }}
        >
          Core
        </div>

        {canAccess('tab-overview') && (
          <Link
            href={`${basePath}${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('')}
          >
            <i className="bi bi-speedometer2 me-3 fs-6"></i>
            Overview
          </Link>
        )}

        {canAccess('tab-clearance') && (
          <Link
            href={`${basePath}/clearance${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/clearance')}
          >
            <i className="bi bi-person-check me-3 fs-6"></i>
            Clearance
          </Link>
        )}

        {canAccess('tab-students') && (
          <Link
            href={`${basePath}/students${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/students')}
          >
            <i className="bi bi-people me-3 fs-6"></i>
            Students Roster
          </Link>
        )}

        {/* ===================================================
            OPERATIONS
        ==================================================== */}

        {(
          canAccess('tab-payment') ||
          canAccess('tab-remittances') ||
          canAccess('tab-advances') ||
          canAccess('tab-audit') ||
          canAccess('tab-penalties') ||
          canAccess('tab-collectibles')
        ) && (
          <div
            className="text-uppercase text-secondary fw-bold px-2 pt-3 pb-1"
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
            }}
          >
            Operations
          </div>
        )}

        {canAccess('tab-payment') && (
          <Link
            href={`${basePath}/collections${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/collections')}
          >
            <i className="bi bi-cash-stack me-3 fs-6"></i>
            Collections
          </Link>
        )}

        {canAccess('tab-remittances') && (
          <Link
            href={`${basePath}/remittances${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/remittances')}
          >
            <i className="bi bi-upload me-3 fs-6"></i>
            Remittance Queue
          </Link>
        )}

        {canAccess('tab-advances') && (
          <Link
            href={`${basePath}/advances${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/advances')}
          >
            <i className="bi bi-journal-arrow-up me-3 fs-6"></i>
            Cash Advances
          </Link>
        )}

        {canAccess('tab-audit') && (
          <Link
            href={`${basePath}/liquidations${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/liquidations')}
          >
            <i className="bi bi-receipt me-3 fs-6"></i>
            Liquidations
          </Link>
        )}

        {canAccess('tab-penalties') && (
          <Link
            href={`${basePath}/penalties${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/penalties')}
          >
            <i className="bi bi-exclamation-octagon me-3 fs-6"></i>
            Penalties & Fines
          </Link>
        )}

        {canAccess('tab-collectibles') && (
          <Link
            href={`${basePath}/collectibles${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/collectibles')}
          >
            <i className="bi bi-inbox me-3 fs-6"></i>
            Collectibles & Dues
          </Link>
        )}

        {/* ===================================================
            AUDIT & REPORTING
        ==================================================== */}

        {(
          canAccess('tab-reports') ||
          canAccess('tab-report') ||
          canAccess('tab-transfer')
        ) && (
          <div
            className="text-uppercase text-secondary fw-bold px-2 pt-3 pb-1"
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
            }}
          >
            Audit & Reporting
          </div>
        )}

        {canAccess('tab-reports') && (
          <Link
            href={`${basePath}/reports${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/reports')}
          >
            <i className="bi bi-bar-chart-line me-3 fs-6"></i>
            Detailed Reports
          </Link>
        )}

        {canAccess('tab-report') && (
          <Link
            href={`${basePath}/summary${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/summary')}
          >
            <i className="bi bi-file-earmark-text me-3 fs-6"></i>
            Summary Report
          </Link>
        )}

        {canAccess('tab-transfer') && (
          <Link
            href={`${basePath}/realign${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/realign')}
          >
            <i className="bi bi-arrow-left-right me-3 fs-6"></i>
            Realign Funds
          </Link>
        )}

        {/* ===================================================
            ADMINISTRATION
        ==================================================== */}

        {(
          canAccess('tab-void') ||
          canAccess('tab-users') ||
          canAccess('tab-setup') ||
          isAdmin
        ) && (
          <div
            className="text-uppercase text-secondary fw-bold px-2 pt-3 pb-1"
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
            }}
          >
            Administration
          </div>
        )}

        {canAccess('tab-void') && (
          <Link
            href={`${basePath}/void${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/void')}
          >
            <i className="bi bi-slash-circle me-3 fs-6"></i>
            Void Center
          </Link>
        )}

        {canAccess('tab-users') && (
          <Link
            href={`${basePath}/users${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/users')}
          >
            <i className="bi bi-person-gear me-3 fs-6"></i>
            User Management
          </Link>
        )}

        {isAdmin && (
          <Link
            href={`${basePath}/logs${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/logs')}
          >
            <i className="bi bi-journal-text me-3 fs-6"></i>
            System Logs
          </Link>
        )}

        {canAccess('tab-setup') && (
          <Link
            href={`${basePath}/setup${queryString}`}
            onClick={handleNavClick}
            className={navItemClass('/setup')}
          >
            <i className="bi bi-sliders me-3 fs-6"></i>
            System Setup
          </Link>
        )}

      </div>
    </nav>
  );
}