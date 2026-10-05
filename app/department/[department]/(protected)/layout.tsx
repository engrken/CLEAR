
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import DepartmentSidebar from "@/app/department/[department]/Sidebar";
import TopHeader from "@/app/department/[department]/TopHeader";
import Footer from "@/app/department/[department]/components/Footer";
import DataPrivacyModal from "@/app/department/[department]/components/DataPrivacyModal";

interface ProtectedDepartmentLayoutProps {
  children: ReactNode;
  params: Promise<{ department: string }>;
}

/*
 * Local CLEAR session-user type.
 *
 * This avoids creating a /types folder.
 * Your auth.ts already provides these values at runtime.
 */
interface ClearSessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  organizationId?: string | null;
  department?: string | null;
  allowedTabs?: string[] | null;
}

export default async function ProtectedDepartmentLayout({
  children,
  params,
}: ProtectedDepartmentLayoutProps) {
  // =========================================================
  // DEPARTMENT
  // =========================================================

  const { department } = await params;

  const cleanDepartment = decodeURIComponent(department)
    .trim()
    .toLowerCase();

  if (!cleanDepartment) {
    redirect("/");
  }

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const session = await auth();

  if (!session?.user) {
    redirect(
      `/department/${encodeURIComponent(
        cleanDepartment
      )}?login=true`
    );
  }

  /*
   * Tell TypeScript about the custom CLEAR session fields.
   */
  const user = session.user as ClearSessionUser;

  // =========================================================
  // USER ROLE
  // =========================================================

  const userRole =
    user.role?.trim().toLowerCase() || "";

  // =========================================================
  // ALLOWED TABS
  // =========================================================

  const allowedTabs = Array.isArray(user.allowedTabs)
    ? user.allowedTabs
    : [];

  // =========================================================
  // ALLOWED ROLES
  // =========================================================

  const allowedRoles = new Set([
    "admin",
    "administrator",
    "master",
    "auditor",
    "audit",
    "superadmin",
  ]);

  if (!allowedRoles.has(userRole)) {
    redirect(
      `/department/${encodeURIComponent(
        cleanDepartment
      )}?forbidden=true`
    );
  }

  // =========================================================
  // FIND ORGANIZATION
  // =========================================================

  const organization =
    await prisma.organization.findUnique({
      where: {
        subdomain: cleanDepartment,
      },
    });

  if (!organization) {
    return (
      <div className="container-fluid p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">
            Department Not Found
          </h4>

          <p className="small mb-0">
            The department "{cleanDepartment}" does not
            exist in the database.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // GLOBAL ADMIN
  // =========================================================

  const isGlobalAdmin =
    userRole === "superadmin" ||
    userRole === "master";

  // =========================================================
  // TENANT / DEPARTMENT SECURITY
  // =========================================================

  /*
   * SuperAdmin and Master can access any department.
   *
   * Admin, Administrator, Auditor and normal department
   * accounts must belong to the department they access.
   */
  if (!isGlobalAdmin) {
    if (
      !user.organizationId ||
      user.organizationId !== organization.id
    ) {
      redirect(
        `/department/${encodeURIComponent(
          cleanDepartment
        )}?forbidden=true`
      );
    }
  }

  // =========================================================
  // CURRENT USER
  // =========================================================

  const currentUser = {
    id: user.id || "",
    fullName:
      user.name || "Department Officer",
    role:
      user.role || "OFFICER",
    email:
      user.email || "",
    organizationId:
      user.organizationId || "",
    department:
      user.department || cleanDepartment,
    allowedTabs,
  };

  // =========================================================
  // PROTECTED APPLICATION SHELL
  // =========================================================

  return (
    <div
      className="d-flex min-vh-100"
      style={{
        width: "100%",
        minWidth: 0,
      }}
    >
      {/* =================================================== */}
      {/* SIDEBAR */}
      {/* =================================================== */}

      <DepartmentSidebar
        department={cleanDepartment}
        currentUser={currentUser}
      />

      {/* =================================================== */}
      {/* MAIN APPLICATION AREA */}
      {/* =================================================== */}

      <div
        className="flex-grow-1 d-flex flex-column"
        style={{
          minWidth: 0,
          width: "100%",
        }}
      >
        {/* ================================================= */}
        {/* TOP HEADER */}
        {/* ================================================= */}

        <TopHeader
          department={cleanDepartment}
          currentUser={currentUser}
        />

        {/* ================================================= */}
        {/* PAGE CONTENT */}
        {/* ================================================= */}

        <main
          className="flex-grow-1 p-3 p-md-4"
          style={{
            minWidth: 0,
          }}
        >
          {children}
        </main>

        {/* ================================================= */}
        {/* FOOTER */}
        {/* ================================================= */}

        <Footer />

        {/* ================================================= */}
        {/* DATA PRIVACY MODAL */}
        {/* ================================================= */}

        <DataPrivacyModal />
      </div>
    </div>
  );
}