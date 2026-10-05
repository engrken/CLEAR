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
  params: Promise<{
    department: string;
  }>;
}

export default async function ProtectedDepartmentLayout({
  children,
  params,
}: ProtectedDepartmentLayoutProps) {
  // =========================================================
  // 1. DEPARTMENT
  // =========================================================

  const { department } = await params;

  const cleanDepartment = decodeURIComponent(
    department
  )
    .trim()
    .toLowerCase();

  if (!cleanDepartment) {
    redirect("/");
  }

  // =========================================================
  // 2. AUTHENTICATION
  // =========================================================

  const session = await auth();

  if (!session?.user) {
    redirect(
      `/department/${encodeURIComponent(
        cleanDepartment
      )}?login=true`
    );
  }

  // =========================================================
  // 3. ROLE
  // =========================================================

  const userRole =
    session.user.role
      ?.trim()
      .toLowerCase();

  const allowedRoles = new Set([
    "admin",
    "administrator",
    "master",
    "auditor",
    "audit",
    "superadmin",
  ]);

  if (
    !userRole ||
    !allowedRoles.has(userRole)
  ) {
    redirect(
      `/department/${encodeURIComponent(
        cleanDepartment
      )}?forbidden=true`
    );
  }

  // =========================================================
  // 4. FIND DEPARTMENT
  // =========================================================

  const organization =
    await prisma.organization.findUnique({
      where: {
        subdomain: cleanDepartment,
      },
      select: {
        id: true,
        subdomain: true,
        name: true,
      },
    });

  if (!organization) {
    return (
      <div className="container p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">
            Department Not Found
          </h4>

          <p className="small mb-0">
            The department "
            {cleanDepartment}
            " does not exist in the database.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // 5. DEPARTMENT AUTHORIZATION
  // =========================================================

  const isGlobalAdmin =
    userRole === "superadmin" ||
    userRole === "master";

  /*
   * SuperAdmin and Master may access all departments.
   *
   * Everyone else must belong to the department
   * they are attempting to access.
   */

  if (!isGlobalAdmin) {
    if (
      !session.user.organizationId ||
      session.user.organizationId !==
        organization.id
    ) {
      redirect(
        `/department/${encodeURIComponent(
          cleanDepartment
        )}?forbidden=true`
      );
    }
  }

  // =========================================================
  // 6. PROTECTED DEPARTMENT APPLICATION
  // =========================================================

  return (
    <div
      className="d-flex min-vh-100"
      style={{
        width: "100%",
        minHeight: "100vh",
      }}
    >
      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <DepartmentSidebar
        department={cleanDepartment}
      />

      {/* =====================================================
          MAIN APPLICATION AREA
      ===================================================== */}

      <div
        className="flex-grow-1 d-flex flex-column"
        style={{
          minWidth: 0,
          width: "100%",
        }}
      >
        {/* ===================================================
            TOP HEADER
        =================================================== */}

        <TopHeader
          department={cleanDepartment}
        />

        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <main
          className="flex-grow-1 p-3 p-md-4"
          style={{
            minWidth: 0,
          }}
        >
          {children}
        </main>

        {/* ===================================================
            FOOTER
        =================================================== */}

        <Footer />

        {/* ===================================================
            DATA PRIVACY
        =================================================== */}

        <DataPrivacyModal />
      </div>
    </div>
  );
}