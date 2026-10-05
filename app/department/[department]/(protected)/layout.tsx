// app/department/[department]/(protected)/layout.tsx

import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import DepartmentSidebar from "../Sidebar";
import TopHeader from "../TopHeader";
import Footer from "../components/Footer";
import DataPrivacyModal from "../components/DataPrivacyModal";

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

  const cleanDepartment = decodeURIComponent(department)
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

  const userRole = session.user.role
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

  if (!userRole || !allowedRoles.has(userRole)) {
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
    });

  if (!organization) {
    return (
      <div className="container p-4">
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
  // 5. DEPARTMENT AUTHORIZATION
  // =========================================================

  const isGlobalAdmin =
    userRole === "superadmin" ||
    userRole === "master";

  /*
   * SuperAdmin and Master may access all departments.
   *
   * Everyone else must belong to the department they
   * are attempting to access.
   */

  if (!isGlobalAdmin) {
    if (
      !session.user.organizationId ||
      session.user.organizationId !== organization.id
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
    <div className="d-flex min-vh-100">
      <DepartmentSidebar
        department={cleanDepartment}
      />

      <div
        className="flex-grow-1 d-flex flex-column"
        style={{ minWidth: 0 }}
      >
        <TopHeader
          department={cleanDepartment}
        />

        <main className="flex-grow-1 p-3 p-md-4">
          {children}
        </main>

        <Footer />

        <DataPrivacyModal />
      </div>
    </div>
  );
}