import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { fmt, formatHoursAndMinutes } from '@/lib/utils';
import { format } from 'date-fns';
import crypto from 'crypto';
import Link from 'next/link';
import Image from 'next/image';
import ClearanceClientView from './ClearanceClientView';

// =========================================================
// LEGACY TERM PACKAGES MAPPING
// =========================================================

const termPackages: Record<string, number> = {
  "1st Sem": 650.00,
  "2nd Sem": 900.00,
  "Summer": 200.00
};

export default async function ClearancePage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    q?: string;
    sig?: string;
  }>;
}) {

  // =======================================================
  // PARAMETERS
  // =======================================================

  const { department } = await params;

  const resolvedSearch = searchParams
    ? await searchParams
    : {};

  const ay =
    resolvedSearch.ay ||
    'A.Y. 2026 - 2027';

  const term =
    resolvedSearch.term ||
    '1st Sem';

  const q =
    resolvedSearch.q?.trim();

  const sigParam =
    resolvedSearch.sig?.trim();

  // =======================================================
  // DEPARTMENT PATH
  // =======================================================

  /*
   * IMPORTANT:
   *
   * The application now uses:
   *
   * /department/[department]/...
   *
   * Example:
   *
   * /department/engineering
   * /department/engineering/clearance
   * /department/engineering/collections
   *
   * Do NOT use:
   *
   * http://engineering.localhost:3000
   *
   * because production is running on Vercel.
   */

  const cleanDepartment =
    decodeURIComponent(department)
      .toLowerCase()
      .trim();

  const basePath =
    `/department/${encodeURIComponent(cleanDepartment)}`;

  // =======================================================
  // COMMON QUERY STRING
  // =======================================================

  const queryString =
    `?ay=${encodeURIComponent(ay)}` +
    `&term=${encodeURIComponent(term)}`;

  // =======================================================
  // FIND ORGANIZATION
  // =======================================================

  const organization =
    await prisma.organization.findUnique({
      where: {
        subdomain: cleanDepartment,
      },
    });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">

        <h4 className="fw-bold mb-2">
          Department Not Found
        </h4>

        <p className="small mb-0">
          The department '
          {decodeURIComponent(department)}
          ' does not exist.
        </p>

      </div>
    );
  }

  // =======================================================
  // AUTHENTICATION
  // =======================================================

  const session = await auth();

  const isOfficer =
    !!session?.user;

  // =======================================================
  // CRYPTOGRAPHIC SIGNATURE VERIFICATION
  // =======================================================

  const salt =
    process.env.CLEARANCE_SALT ||
    'JIECEP_CLEARANCE_KEY_2026';

  if (sigParam && q) {

    const expectedSig =
      crypto
        .createHash('sha256')
        .update(
          `${q}|${ay}|${term}|${salt}`
        )
        .digest('hex');

    const isSignatureValid =
      sigParam.toLowerCase() ===
      expectedSig.toLowerCase();

    return (
      <div
        className="card p-4 border-secondary text-center shadow-lg"
        style={{
          maxWidth: '500px',
          margin: '0 auto',
          marginTop: '2rem',
          backgroundColor: '#1e293b'
        }}
      >

        <h4 className="text-info fw-bold mb-1">
          College of {decodeURIComponent(department)}
        </h4>

        <small className="text-secondary d-block mb-4">
          Centralized Liquidation of Expense & Audit Records
        </small>

        {isSignatureValid ? (

          <>
            <div className="bg-success text-white p-3 rounded fw-bold fs-5 mb-4 shadow-sm">
              <i className="bi bi-check-circle-fill me-2"></i>
              OFFICIAL CLEARANCE VALID
            </div>

            <table className="table table-sm table-borderless text-start text-white mb-4">
              <tbody>

                <tr className="border-bottom border-secondary">
                  <td className="text-secondary py-2">
                    Student ID:
                  </td>

                  <td className="fw-bold text-info py-2">
                    {q}
                  </td>
                </tr>

                <tr className="border-bottom border-secondary">
                  <td className="text-secondary py-2">
                    Academic Term:
                  </td>

                  <td className="py-2">
                    {term} ({ay})
                  </td>
                </tr>

                <tr className="border-bottom border-secondary">
                  <td className="text-secondary py-2">
                    Verification Time:
                  </td>

                  <td className="py-2">
                    {format(
                      new Date(),
                      'MMM dd, yyyy - hh:mm a'
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="text-secondary py-2">
                    Crypto Hash:
                  </td>

                  <td className="font-monospace text-secondary small py-2">
                    {sigParam.substring(0, 16)}...
                  </td>
                </tr>

              </tbody>
            </table>

            <p className="text-success small fw-semibold m-0">
              This certificate confirms zero financial arrears,
              penalties, or unliquidated advances for the
              specified period.
            </p>
          </>

        ) : (

          <div className="bg-danger text-white p-3 rounded fw-bold fs-5 mb-3 shadow-sm">

            <i className="bi bi-x-circle-fill me-2"></i>
            INVALID OR TAMPERED

            <p className="fs-6 fw-normal m-0 mt-2">
              This clearance token does not match department
              records, or active obligations were logged after
              issuance.
            </p>

          </div>

        )}

      </div>
    );
  }

  // =======================================================
  // FINANCIAL LEDGER DATA
  // =======================================================

  let studentRecord = null;

  let isCleared = false;

  const pendingDues: string[] = [];

  let collections: any[] = [];

  let penalties: any[] = [];

  let cashAdvances: any[] = [];

  let clearanceSig = "";

  let verifyUrl = "";

  // =======================================================
  // SEARCH STUDENT
  // =======================================================

  if (q) {

    studentRecord =
      await prisma.student.findFirst({
        where: {
          organizationId: organization.id,

          OR: [
            {
              studentId: {
                equals: q,
                mode: 'insensitive'
              }
            },

            {
              email: {
                equals: q,
                mode: 'insensitive'
              }
            },

            {
              fullName: {
                contains: q,
                mode: 'insensitive'
              }
            }
          ]
        }
      });

    if (studentRecord) {

      [
        collections,
        penalties,
        cashAdvances
      ] = await Promise.all([

        // COLLECTIONS
        prisma.collection.findMany({
          where: {
            organizationId: organization.id,
            academicYear: ay,
            term,
            studentId:
              studentRecord.studentId
          },

          orderBy: {
            date: 'desc'
          }
        }),

        // PENALTIES
        prisma.penalty.findMany({
          where: {
            organizationId: organization.id,
            academicYear: ay,
            term,
            studentId:
              studentRecord.studentId
          },

          orderBy: {
            date: 'desc'
          }
        }),

        // CASH ADVANCES
        prisma.cashAdvance.findMany({
          where: {
            organizationId: organization.id,
            academicYear: ay,
            term,

            requestor: {
              contains:
                studentRecord.studentId
            }
          },

          orderBy: {
            dateIssued: 'desc'
          }
        })

      ]);

      // =====================================================
      // DEPARTMENTAL PACKAGE
      // =====================================================

      const pkgRate =
        termPackages[term] || 0;

      const deptFeePaid =
        collections

          .filter(
            c =>
              c.category.includes(
                'Departmental Fee'
              ) &&
              !c.paymentType
                .toUpperCase()
                .includes('VOID')
          )

          .reduce(
            (sum, c) =>
              sum + (c.amountPaid || 0),
            0
          );

      if (
        pkgRate > 0 &&
        deptFeePaid < pkgRate
      ) {

        pendingDues.push(
          `Departmental Fee Package (${fmt(
            pkgRate - deptFeePaid
          )} remaining)`
        );

      }

      // =====================================================
      // PENALTIES
      // =====================================================

      const unsettledPenalties =
        penalties.filter(
          p =>
            !p.status.includes('Settled') &&
            !p.status.includes('Voided')
        );

      if (
        unsettledPenalties.length > 0
      ) {

        const totalPen =
          unsettledPenalties.reduce(
            (sum, p) =>
              sum + (p.fineAmount || 0),
            0
          );

        pendingDues.push(
          `Unpaid Penalty Arrears (${fmt(
            totalPen
          )})`
        );
      }

      // =====================================================
      // CASH ADVANCES
      // =====================================================

      const activeAdvances =
        cashAdvances.filter(
          ca =>
            ca.status.includes('Pending') &&
            !ca.status.includes('Cancel')
        );

      if (
        activeAdvances.length > 0
      ) {

        activeAdvances.forEach(
          ca => {

            pendingDues.push(
              `Unliquidated Cash Advance [${ca.advanceId}]: ${fmt(
                ca.amountApproved
              )}`
            );

          }
        );
      }

      // =====================================================
      // CLEARANCE STATUS
      // =====================================================

      isCleared =
        pendingDues.length === 0;

      // ==========================================