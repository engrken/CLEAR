// app/department/[department]/page.tsx

import { prisma } from "@/lib/prisma";
import { getDepartmentFinancials } from "./actions";
import Link from "next/link";
import { auth } from "@/auth";
import OtpModal from "./components/OtpModal";
import DashboardClient from "./DashboardClient";
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function EntityOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    subtab?: string;
    login?: string;
    forbidden?: string;
  }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};

  // =========================================================
  // 1. FORMAT PATH
  // =========================================================
  const cleanSubdomain = decodeURIComponent(department).toLowerCase().trim();
  const basePath = `/department/${encodeURIComponent(cleanSubdomain)}`;

  // =========================================================
  // 2. FIND ORGANIZATION
  // =========================================================
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanSubdomain,
    },
  });

  if (!organization) {
    return (
      <div className="container p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">Entity Not Found</h4>
          <p className="small mb-0">
            The registered entity "{cleanSubdomain}" does not exist in the database.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. DYNAMIC ACADEMIC YEAR & TERM (DATABASE LINKED)
  // =========================================================
  const ay = resolvedSearch.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || organization.activeTerm || "1st Sem";
  const queryString = `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  // =========================================================
  // 4. SESSION
  // =========================================================
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);

  // =========================================================
  // 5. PREMIUM UNAUTHENTICATED ENTRY (PUBLIC TENANT PORTAL)
  // =========================================================
  if (!isAuthenticated) {
    return (
      <>
        <div className="container py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
          <div
            className="card border-secondary shadow-lg bg-card p-4 p-md-5 text-center mx-auto w-100 position-relative overflow-hidden"
            style={{ maxWidth: "650px", borderRadius: "1.25rem" }}
          >
            {/* Subtle background glow effect */}
            <div className="position-absolute top-0 start-50 translate-middle-x w-100 h-50" style={{ background: 'radial-gradient(ellipse at top, rgba(56,189,248,0.15), transparent 70%)', zIndex: 0 }}></div>
            
            <div className="mb-4 position-relative" style={{ zIndex: 1 }}>
              <div className="d-inline-flex align-items-center justify-content-center bg-body-tertiary border border-secondary-subtle rounded-circle mb-3 shadow" style={{ width: '100px', height: '100px', padding: '15px' }}>
                <img 
                  src={organization.logo || `/${cleanSubdomain}_logo.png`} 
                  alt={`${organization.name} Logo`} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              
              <h3 className="fw-bold mb-2" style={{ lineHeight: '1.3' }}>
                {organization.name}
              </h3>
              <p className="text-secondary mb-0 mx-auto" style={{ maxWidth: '85%' }}>
                Welcome to the Centralized Liquidation of Expenses & Audit Records (CLEAR) System.
              </p>
            </div>

            {resolvedSearch.login === "true" && (
              <div className="alert alert-info text-start small border-info shadow-sm position-relative" style={{ zIndex: 1 }}>
                <i className="bi bi-info-circle me-2"></i>
                Please authenticate using your registered institutional email.
              </div>
            )}

            {resolvedSearch.forbidden === "true" && (
              <div className="alert alert-danger text-start small border-danger shadow-sm position-relative" style={{ zIndex: 1 }}>
                <i className="bi bi-shield-exclamation me-2"></i>
                You are not authorized to access this {organization.type.toLowerCase()}.
              </div>
            )}

            <div className="row g-3 mt-2 position-relative" style={{ zIndex: 1 }}>
              <div className="col-12 col-sm-6">
                <Link
                  href={`${basePath}/clearance${queryString}`}
                  className="btn btn-outline-info w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3 bg-body-tertiary"
                  style={{ transition: 'all 0.2s ease', border: '1px solid rgba(56,189,248,0.3)' }}
                >
                  <i className="bi bi-person-check fs-2 mb-2"></i>
                  <span className="fw-bold">Student Clearance</span>
                  <small className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>Public Verification</small>
                </Link>
              </div>

              <div className="col-12 col-sm-6">
                <button
                  type="button"
                  className="btn btn-info w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3 text-dark shadow"
                  style={{ transition: 'all 0.2s ease' }}
                  data-bs-toggle="modal"
                  data-bs-target="#otpAuthModal"
                >
                  <i className="bi bi-shield-lock-fill fs-2 mb-2"></i>
                  <span className="fw-bold">Officer Login</span>
                  <small className="text-dark opacity-75 mt-1" style={{ fontSize: '0.75rem' }}>Secure Access</small>
                </button>
              </div>
            </div>

            <div className="mt-5 pt-3 border-top border-secondary position-relative" style={{ zIndex: 1 }}>
              <Link
                href="/dashboard"
                className="text-secondary small text-decoration-none hover-info"
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back to System Gateway
              </Link>
            </div>
          </div>
        </div>
        <OtpModal
			department={cleanSubdomain}
			orgName={organization.name}
			orgType={organization.type}
			/>
      </>
    );
  }

  // =========================================================
  // 6. AUTHENTICATED USERS (PREMIUM FINANCIAL DASHBOARD)
  // =========================================================

  const overview = await getDepartmentFinancials(organization.id, ay, term);

  // BULLETPROOF SERIALIZATION for Client Components
  const serialize = (data: any) => JSON.parse(JSON.stringify(data || {}));

  return (
    <DashboardClient 
      overview={serialize(overview)}
      organization={serialize(organization)}
      ay={ay}
      term={term}
      basePath={basePath}
      queryString={queryString}
    />
  );
}