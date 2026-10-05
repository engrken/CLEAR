
"use client";

import Link from "next/link";
import {
  usePathname,
  useSearchParams,
} from "next/navigation";
import { useMemo, useState, useEffect } from "react";

interface CurrentUser {
  id?: string;
  fullName?: string;
  role?: string;
  email?: string;
  organizationId?: string;
  department?: string;
  allowedTabs?: string[];
}

interface DepartmentSidebarProps {
  department: string;
  currentUser?: CurrentUser;
}

export default function DepartmentSidebar({
  department,
  currentUser,
}: DepartmentSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // =========================================================
  // USER
  // =========================================================

  const role =
    currentUser?.role?.trim().toLowerCase() || "";

  const allowedTabs = useMemo(() => {
    if (
      Array.isArray(
        currentUser?.allowedTabs
      )
    ) {
      return currentUser.allowedTabs;
    }

    return [];
  }, [currentUser?.allowedTabs]);

  // =========================================================
  // ADMIN ACCESS
  // =========================================================

  const isAdmin =
    role === "admin" ||
    role === "administrator" ||
    role === "master" ||
    role === "superadmin";

  // =========================================================
  // DEPARTMENT
  // =========================================================

  const deptKey = department
    ? decodeURIComponent(department)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
    : "engineering";

  const basePath =
    `/department/${encodeURIComponent(
      deptKey
    )}`;

  // =========================================================
  // ACADEMIC YEAR
  // =========================================================

  const ay =
    searchParams.get("ay") ||
    "A.Y. 2026 - 2027";

  const term =
    searchParams.get("term") ||
    "1st Sem";

  const queryString =
    `?ay=${encodeURIComponent(ay)}` +
    `&term=${encodeURIComponent(term)}`;

  // =========================================================
  // LOGOS
  // =========================================================

  const logoPath =
    `/${deptKey}_logo.png`;

  const fallbackLogoPath =
    "/engineering_logo.png";

  // =========================================================
  // MOBILE SIDEBAR
  // =========================================================

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 992) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  // =========================================================
  // ACTIVE LINK
  // =========================================================

  const isActive = (path: string) => {
    const fullPath =
      `${basePath}${path}`;

    if (path === "") {
      return (
        pathname === basePath ||
        pathname === `${basePath}/`
      );
    }

    return (
      pathname === fullPath ||
      pathname.startsWith(
        `${fullPath}/`
      )
    );
  };

  // =========================================================
  // CLOSE MOBILE SIDEBAR
  // =========================================================

  const handleNavClick = () => {
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 992
    ) {
      setSidebarOpen(false);
    }
  };

  // =========================================================
  // TAB ACCESS
  // =========================================================

  const canAccess = (tabId: string) => {
    /*
     * Global/admin users see everything.
     */
    if (isAdmin) {
      return true;
    }

    /*
     * Other users use their allowedTabs from NextAuth.
     */
    return allowedTabs.includes(tabId);
  };

  // =========================================================
  // NAV ITEM CLASS
  // =========================================================

  const navItemClass = (path: string) => `
    list-group-item
    list-group-item-action
    rounded
    py-2
    px-3
    d-flex
    align-items-center
    text-decoration-none
    border-0
    mb-1
    ${
      isActive(path)
        ? "bg-info bg-opacity-10 text-info fw-bold border-start border-info border-4"
        : "text-secondary"
    }
  `;

  // =========================================================
  // SECTION TITLE
  // =========================================================

  const sectionTitle = (
    title: string
  ) => (
    <div className="text-uppercase text-secondary small fw-bold mt-3 mb-2 px-2">
      {title}
    </div>
  );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      {/* =================================================== */}
      {/* MOBILE MENU BUTTON */}
      {/* =================================================== */}

      <button
        type="button"
        className="btn btn-dark d-lg-none position-fixed"
        style={{
          top: "12px",
          left: "12px",
          zIndex: 1050,
        }}
        onClick={() =>
          setSidebarOpen(
            (previous) => !previous
          )
        }
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      {/* =================================================== */}
      {/* SIDEBAR */}
      {/* =================================================== */}

      <nav
        id="appSidebar"
        className={`sidebar border-end border-secondary bg-card p-3 d-flex flex-column custom-scrollbar ${
          sidebarOpen ? "show" : ""
        }`}
        style={{
          width: "280px",
          minWidth: "280px",
          height: "100vh",
          position: "sticky",
          top: 0,
          overflowY: "auto",
          transition: "all 0.3s ease",
          zIndex: 1040,
        }}
      >
        {/* ================================================= */}
        {/* BRAND */}
        {/* ================================================= */}

        <div className="text-center mb-4">
          <img
            src={logoPath}
            alt={`${department} Logo`}
            className="img-fluid mb-2"
            style={{
              maxHeight: "70px",
              maxWidth: "180px",
              objectFit: "contain",
            }}
            onError={(event) => {
              const image =
                event.currentTarget;

              if (
                image.src !==
                `${window.location.origin}${fallbackLogoPath}`
              ) {
                image.src =
                  fallbackLogoPath;
              }
            }}
          />

          <div className="fw-bold text-info">
            CLEAR
          </div>

          <div className="small text-secondary">
            {department
              .charAt(0)
              .toUpperCase() +
              department.slice(1)}{" "}
            Department
          </div>
        </div>

        {/* ================================================= */}
        {/* CURRENT USER */}
        {/* ================================================= */}

        <div className="bg-dark bg-opacity-25 rounded p-3 mb-3">
          <div className="small text-secondary">
            Signed in as
          </div>

          <div
            className="fw-bold text-light text-truncate"
            title={
              currentUser?.fullName || ""
            }
          >
            {currentUser?.fullName ||
              "Department Officer"}
          </div>

          <div className="small text-info text-uppercase">
            {currentUser?.role ||
              "OFFICER"}
          </div>
        </div>

        {/* ================================================= */}
        {/* NAVIGATION */}
        {/* ================================================= */}

        <div className="list-group list-group-flush">

          {/* ================================================= */}
          {/* CORE */}
          {/* ================================================= */}

          {sectionTitle("Core")}

          {canAccess("tab-overview") && (
            <Link
              href={`${basePath}${queryString}`}
              className={navItemClass("")}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ⌂
              </span>
              Overview
            </Link>
          )}

          {canAccess("tab-clearance") && (
            <Link
              href={`${basePath}/clearance${queryString}`}
              className={navItemClass(
                "/clearance"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ✓
              </span>
              Clearance
            </Link>
          )}

          {canAccess("tab-students") && (
            <Link
              href={`${basePath}/students${queryString}`}
              className={navItemClass(
                "/students"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ♙
              </span>
              Students
            </Link>
          )}

          {/* ================================================= */}
          {/* OPERATIONS */}
          {/* ================================================= */}

          {sectionTitle("Operations")}

          {canAccess("tab-collections") && (
            <Link
              href={`${basePath}/collections${queryString}`}
              className={navItemClass(
                "/collections"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ₱
              </span>
              Collections
            </Link>
          )}

          {canAccess("tab-remittances") && (
            <Link
              href={`${basePath}/remittances${queryString}`}
              className={navItemClass(
                "/remittances"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ⇄
              </span>
              Remittances
            </Link>
          )}

          {canAccess("tab-advances") && (
            <Link
              href={`${basePath}/advances${queryString}`}
              className={navItemClass(
                "/advances"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ▣
              </span>
              Cash Advances
            </Link>
          )}

          {canAccess("tab-liquidations") && (
            <Link
              href={`${basePath}/liquidations${queryString}`}
              className={navItemClass(
                "/liquidations"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ▤
              </span>
              Liquidations
            </Link>
          )}

          {canAccess("tab-penalties") && (
            <Link
              href={`${basePath}/penalties${queryString}`}
              className={navItemClass(
                "/penalties"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                !
              </span>
              Penalties
            </Link>
          )}

          {canAccess("tab-collectibles") && (
            <Link
              href={`${basePath}/collectibles${queryString}`}
              className={navItemClass(
                "/collectibles"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ◈
              </span>
              Collectibles
            </Link>
          )}

          {/* ================================================= */}
          {/* AUDIT & REPORTING */}
          {/* ================================================= */}

          {sectionTitle(
            "Audit & Reporting"
          )}

          {canAccess("tab-reports") && (
            <Link
              href={`${basePath}/reports${queryString}`}
              className={navItemClass(
                "/reports"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ▥
              </span>
              Reports
            </Link>
          )}

          {canAccess("tab-summary") && (
            <Link
              href={`${basePath}/summary${queryString}`}
              className={navItemClass(
                "/summary"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ▦
              </span>
              Summary
            </Link>
          )}

          {canAccess("tab-realign") && (
            <Link
              href={`${basePath}/realign${queryString}`}
              className={navItemClass(
                "/realign"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ↻
              </span>
              Fund Realignment
            </Link>
          )}

          {/* ================================================= */}
          {/* ADMINISTRATION */}
          {/* ================================================= */}

          {sectionTitle(
            "Administration"
          )}

          {canAccess("tab-void") && (
            <Link
              href={`${basePath}/void${queryString}`}
              className={navItemClass(
                "/void"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ⊘
              </span>
              Void Transactions
            </Link>
          )}

          {canAccess("tab-users") && (
            <Link
              href={`${basePath}/users${queryString}`}
              className={navItemClass(
                "/users"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ♙
              </span>
              Users
            </Link>
          )}

          {canAccess("tab-logs") && (
            <Link
              href={`${basePath}/logs${queryString}`}
              className={navItemClass(
                "/logs"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ☷
              </span>
              System Logs
            </Link>
          )}

          {canAccess("tab-setup") && (
            <Link
              href={`${basePath}/setup${queryString}`}
              className={navItemClass(
                "/setup"
              )}
              onClick={handleNavClick}
            >
              <span className="me-2">
                ⚙
              </span>
              Setup
            </Link>
          )}
        </div>

        {/* ================================================= */}
        {/* SPACER */}
        {/* ================================================= */}

        <div className="flex-grow-1" />

        {/* ================================================= */}
        {/* ACADEMIC INFORMATION */}
        {/* ================================================= */}

        <div className="border-top border-secondary pt-3 mt-3">
          <div className="small text-secondary">
            Academic Year
          </div>

          <div className="small text-light">
            {ay}
          </div>

          <div className="small text-secondary mt-2">
            Term
          </div>

          <div className="small text-light">
            {term}
          </div>
        </div>
      </nav>

      {/* =================================================== */}
      {/* MOBILE BACKDROP */}
      {/* =================================================== */}

      {sidebarOpen && (
        <div
          className="d-lg-none position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
          style={{
            zIndex: 1030,
          }}
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* =================================================== */}
      {/* MOBILE CSS */}
      {/* =================================================== */}

      <style jsx>{`
        @media (max-width: 991.98px) {
          #appSidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            transform: translateX(-100%);
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.4);
          }

          #appSidebar.show {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}