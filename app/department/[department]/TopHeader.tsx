
"use client";

import {
  useRouter,
  useSearchParams,
  usePathname,
} from "next/navigation";

import {
  useState,
  useEffect,
  Suspense,
} from "react";

import { signOut } from "next-auth/react";

import LoginModal from "./LoginModal";

interface CurrentUser {
  id?: string;
  fullName?: string;
  role?: string;
  email?: string;
  organizationId?: string;
  department?: string;
  allowedTabs?: string[];
}

interface TopHeaderProps {
  department: string;
  currentUser?: CurrentUser;
}

function TopHeaderContent({
  department,
  currentUser,
}: TopHeaderProps) {
  const router = useRouter();
  const searchParams =
    useSearchParams();
  const pathname =
    usePathname();

  // =========================================================
  // ACADEMIC YEAR / TERM
  // =========================================================

  const ay =
    searchParams.get("ay") ||
    "A.Y. 2026 - 2027";

  const term =
    searchParams.get("term") ||
    "1st Sem";

  // =========================================================
  // STATE
  // =========================================================

  const [theme, setTheme] =
    useState("dark");

  const [userName, setUserName] =
    useState(
      currentUser?.fullName ||
        "Department Officer"
    );

  const [role, setRole] =
    useState(
      currentUser?.role ||
        "OFFICER"
    );

  const [showModal, setShowModal] =
    useState(false);

  const [showForbidden, setShowForbidden] =
    useState(false);

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  // =========================================================
  // UPDATE USER
  // =========================================================

  useEffect(() => {
    setUserName(
      currentUser?.fullName ||
        "Department Officer"
    );

    setRole(
      currentUser?.role ||
        "OFFICER"
    );
  }, [currentUser]);

  // =========================================================
  // LOGIN / FORBIDDEN PARAMETERS
  // =========================================================

  useEffect(() => {
    const loginParam =
      searchParams.get("login");

    const forbiddenParam =
      searchParams.get(
        "forbidden"
      );

    let shouldCleanUrl = false;

    const params =
      new URLSearchParams(
        searchParams.toString()
      );

    if (loginParam === "true") {
      setShowModal(true);

      params.delete("login");

      shouldCleanUrl = true;
    }

    if (forbiddenParam === "true") {
      setShowForbidden(true);

      params.delete("forbidden");

      shouldCleanUrl = true;

      const timer =
        setTimeout(() => {
          setShowForbidden(false);
        }, 5000);

      if (shouldCleanUrl) {
        const query =
          params.toString();

        router.replace(
          query
            ? `${pathname}?${query}`
            : pathname
        );
      }

      return () => {
        clearTimeout(timer);
      };
    }

    if (shouldCleanUrl) {
      const query =
        params.toString();

      router.replace(
        query
          ? `${pathname}?${query}`
          : pathname
      );
    }
  }, [
    searchParams,
    pathname,
    router,
  ]);

  // =========================================================
  // THEME
  // =========================================================

  useEffect(() => {
    const savedTheme =
      localStorage.getItem(
        "fcu_clear_theme"
      );

    const currentTheme =
      savedTheme ||
      document.documentElement.getAttribute(
        "data-bs-theme"
      ) ||
      "dark";

    setTheme(currentTheme);

    document.documentElement.setAttribute(
      "data-bs-theme",
      currentTheme
    );
  }, []);

  // =========================================================
  // THEME TOGGLE
  // =========================================================

  const toggleTheme = () => {
    const newTheme =
      theme === "dark"
        ? "light"
        : "dark";

    setTheme(newTheme);

    localStorage.setItem(
      "fcu_clear_theme",
      newTheme
    );

    document.documentElement.setAttribute(
      "data-bs-theme",
      newTheme
    );
  };

  // =========================================================
  // FILTER
  // =========================================================

  const handleFilterChange = (
    newAy: string,
    newTerm: string
  ) => {
    const params =
      new URLSearchParams(
        searchParams.toString()
      );

    params.set(
      "ay",
      newAy
    );

    params.set(
      "term",
      newTerm
    );

    router.push(
      `${pathname}?${params.toString()}`
    );
  };

  // =========================================================
  // SIGN OUT
  // =========================================================

  const handleAuthAction = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      /*
       * NextAuth handles the authentication
       * session/cookie.
       */
      await signOut({
        callbackUrl:
          `/department/${encodeURIComponent(
            department
          )}`,
      });
    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );

      setIsLoggingOut(false);

      alert(
        "Unable to sign out. Please try again."
      );
    }
  };

  // =========================================================
  // ROLE
  // =========================================================

  const displayRole =
    role?.trim() ||
    "OFFICER";

  const normalizedRole =
    displayRole.toLowerCase();

  const isAdmin =
    normalizedRole === "admin" ||
    normalizedRole === "administrator" ||
    normalizedRole === "master" ||
    normalizedRole === "superadmin";

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <>
      {/* =================================================== */}
      {/* HEADER */}
      {/* =================================================== */}

      <header
        className="navbar navbar-expand border-bottom border-secondary px-3 px-md-4 py-3 bg-card shadow-sm flex-column align-items-stretch"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        {/* ================================================= */}
        {/* TOP ROW */}
        {/* ================================================= */}

        <div className="d-flex align-items-center justify-content-between gap-3">

          {/* BRAND */}
          <div className="d-flex align-items-center gap-3 min-width-0">

            <img
              src="/fcu.png"
              alt="Filamer Christian University"
              style={{
                width: "48px",
                height: "48px",
                objectFit: "contain",
              }}
            />

            <div
              className="min-width-0"
              style={{
                minWidth: 0,
              }}
            >
              <div className="fw-bold text-light text-truncate">
                CLEAR
              </div>

              <div className="small text-secondary text-truncate">
                Centralized Liquidation of Expenses & Audit Records
              </div>

              <div className="small text-info text-uppercase">
                {department} Department
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="d-flex align-items-center gap-2">

            {/* THEME */}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? "☀"
                : "☾"}
            </button>

            {/* ROLE */}
            <span
              className={`badge ${
                isAdmin
                  ? "text-bg-warning"
                  : "text-bg-info"
              } d-none d-md-inline-block`}
            >
              {displayRole.toUpperCase()}
            </span>

            {/* USER */}
            <div className="text-end d-none d-lg-block">
              <div className="small fw-bold text-light">
                {userName}
              </div>

              <div className="small text-secondary">
                {currentUser?.email ||
                  ""}
              </div>
            </div>

            {/* SIGN OUT */}
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={
                handleAuthAction
              }
              disabled={
                isLoggingOut
              }
            >
              {isLoggingOut
                ? "Signing out..."
                : "Sign Out"}
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* FILTER ROW */}
        {/* ================================================= */}

        <div className="d-flex flex-wrap align-items-center gap-2 mt-3">

          <span className="small text-secondary">
            Academic Year:
          </span>

          <select
            className="form-select form-select-sm bg-dark text-light border-secondary"
            style={{
              width: "auto",
              minWidth: "150px",
            }}
            value={ay}
            onChange={(event) =>
              handleFilterChange(
                event.target.value,
                term
              )
            }
          >
            <option>
              A.Y. 2025 - 2026
            </option>

            <option>
              A.Y. 2026 - 2027
            </option>

            <option>
              A.Y. 2027 - 2028
            </option>
          </select>

          <span className="small text-secondary ms-2">
            Term:
          </span>

          <select
            className="form-select form-select-sm bg-dark text-light border-secondary"
            style={{
              width: "auto",
              minWidth: "120px",
            }}
            value={term}
            onChange={(event) =>
              handleFilterChange(
                ay,
                event.target.value
              )
            }
          >
            <option>
              1st Sem
            </option>

            <option>
              2nd Sem
            </option>

            <option>
              Summer
            </option>
          </select>
        </div>
      </header>

      {/* =================================================== */}
      {/* ACCESS DENIED */}
      {/* =================================================== */}

      {showForbidden && (
        <div
          className="alert alert-danger rounded-0 border-0 border-bottom border-danger shadow-sm mb-0"
          role="alert"
        >
          <div className="container-fluid">
            <strong>
              Access Denied
            </strong>

            <span className="ms-2">
              You do not have permission
              to access that page.
            </span>
          </div>
        </div>
      )}

      {/* =================================================== */}
      {/* LOGIN MODAL */}
      {/* =================================================== */}

      <LoginModal
        show={showModal}
        onClose={() =>
          setShowModal(false)
        }
        department={department}
      />
    </>
  );
}

// =============================================================
// SUSPENSE WRAPPER
// =============================================================

export default function TopHeader(
  props: TopHeaderProps
) {
  return (
    <Suspense
      fallback={
        <div className="p-3 bg-card border-bottom border-secondary">
          Loading header...
        </div>
      }
    >
      <TopHeaderContent
        {...props}
      />
    </Suspense>
  );
}
