"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import { auth } from "@/auth";
import { logSystemAction } from "@/lib/logger";

// =========================================================================
// GENERAL HELPERS
// =========================================================================

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");

  return `${date.getFullYear()}${pad(
    date.getMonth() + 1
  )}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

function normalizeDepartment(department: string) {
  const clean = String(department || "")
    .trim()
    .toLowerCase();

  if (!clean) {
    throw new Error("Department is required.");
  }

  return clean;
}

function parseAllowedTabs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (v): v is string => typeof v === "string"
    );
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v): v is string => typeof v === "string"
        );
      }
    } catch {
      return [];
    }
  }

  return [];
}

function parseDate(value: string, fieldName: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}.`);
  }

  return date;
}

function money(value: unknown, fieldName = "Amount") {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return Math.round(amount * 100) / 100;
}

function generateReference(prefix: string) {
  return `${prefix}-${formatDate(new Date())}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function isVoidedRecord(row: {
  paymentType?: unknown;
  status?: unknown;
}) {
  const paymentType = String(row.paymentType || "").toUpperCase();
  const status = String(row.status || "").toUpperCase();

  return (
    paymentType.includes("VOID") ||
    status.includes("VOID") ||
    status.includes("CANCEL")
  );
}

/**
 * IMPORTANT:
 * Collection.studentId references Student.id (UUID),
 * NOT Student.studentId.
 *
 * Therefore the financial engine should primarily use
 * the database student ID.
 */
function getStudentKey(
  studentDbId?: unknown,
  studentName?: unknown,
  fallback = ""
) {
  const id = String(studentDbId || "")
    .trim()
    .toLowerCase();

  const name = String(studentName || "")
    .trim()
    .toLowerCase();

  if (id) {
    return `ID:${id}`;
  }

  if (name) {
    return `NAME:${name}`;
  }

  return fallback;
}
function normalizeItemKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
// =========================================================================
// AUTHORIZATION
// =========================================================================

export async function requireTabAccess(requiredTab: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error(
      "401 Unauthorized: Session expired or invalid."
    );
  }

  const customUser = session.user as any;

  const allowedTabs = parseAllowedTabs(
    customUser.allowedTabs
  );

  if (!allowedTabs.includes(requiredTab)) {
    throw new Error(
      `403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`
    );
  }

  return customUser;
}

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user) {
    throw new Error(
      "401 Unauthorized: Session expired or invalid."
    );
  }

  const user = session.user as any;

  const role = String(user.role || "")
    .trim()
    .toLowerCase();

  const allowedTabs = parseAllowedTabs(
    user.allowedTabs
  );

  const configuredSuperAdminEmail =
    String(process.env.SUPER_ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

  const sessionEmail =
    String(user.email || "")
      .trim()
      .toLowerCase();

  const roleIsAdmin =
    role === "admin" ||
    role === "administrator" ||
    role === "superadmin" ||
    role === "super admin" ||
    role === "super_admin";

  const hasProvisionPermission =
    allowedTabs.includes("tab-provision");

  const matchesConfiguredEmail =
    configuredSuperAdminEmail !== "" &&
    sessionEmail === configuredSuperAdminEmail;

  if (
    !roleIsAdmin &&
    !hasProvisionPermission &&
    !matchesConfiguredEmail
  ) {
    throw new Error(
      "403 Forbidden: Super administrator privileges are required."
    );
  }

  return user;
}

// =========================================================================
// ORGANIZATION / TENANT
// =========================================================================

/**
 * Public resolver.
 *
 * Do NOT require a session here.
 *
 * Used by:
 * - requestOtp()
 * - verifyOtp()
 * - submitOnlineRemittance()
 */
async function resolveOrganizationId(
  department: string
) {
  const cleanDepartment =
    normalizeDepartment(department);

  const org =
    await prisma.organization.findUnique({
      where: {
        subdomain: cleanDepartment,
      },
      select: {
        id: true,
      },
    });

  if (!org) {
    throw new Error(
      "Department organization not found."
    );
  }

  return org.id;
}

/**
 * Verifies that the authenticated user belongs
 * to the requested organization.
 */
async function requireOrganizationAccess(
  organizationId: string
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error(
      "401 Unauthorized: Session expired or invalid."
    );
  }

  const email = String(
    session.user.email || ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error(
      "401 Unauthorized: Session has no email."
    );
  }

  const user =
    await prisma.tenantUser.findFirst({
      where: {
        organizationId,
        email,
        status: "Active",
      },
    });

  if (!user) {
    throw new Error(
      "403 Forbidden: You do not have access to this department."
    );
  }

  return user;
}

/**
 * Authenticated organization resolver.
 *
 * Normal protected actions use this.
 */
async function getOrgId(
  department: string
) {
  const organizationId =
    await resolveOrganizationId(
      department
    );

  await requireOrganizationAccess(
    organizationId
  );

  return organizationId;
}

async function getActionUser(): Promise<string> {
  const session = await auth();

  const user =
    session?.user as
      | {
          fullName?: string;
          email?: string;
        }
      | undefined;

  return (
    user?.fullName ||
    user?.email ||
    "System"
  );
}

// =========================================================================
// DEPARTMENT PROVISIONING
// =========================================================================

export async function createDepartment(
  formData: FormData
) {
  await requireSuperAdmin();

  const name = String(
    formData.get("name") || ""
  ).trim();

  const subdomain = String(
    formData.get("subdomain") || ""
  )
    .trim()
    .toLowerCase();

  if (!name || !subdomain) {
    throw new Error(
      "Department name and subdomain are required."
    );
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error(
      "Subdomain may contain only lowercase letters, numbers, and hyphens."
    );
  }

  try {
    await prisma.organization.create({
      data: {
        name,
        subdomain,
      },
    });

    revalidatePath("/");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Department '${name}' successfully registered!`,
    };
  } catch (error) {
    console.error(
      "createDepartment error:",
      error
    );

    return {
      success: false,
      message:
        "Subdomain already exists or the department could not be created.",
    };
  }
}

// =========================================================================
// COLLECTIBLES
// =========================================================================

export async function assessStudentDue(
  department: string,
  payload: {
    studentId: string;
    studentName: string;
    category: string;
    itemDescription: string;
    amountDue: number;
    fundAllocation: string;
    date: string;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-collectibles"
  );

  const orgId =
    await getOrgId(department);

  const amountDue = money(
    payload.amountDue,
    "Amount due"
  );

  if (amountDue <= 0) {
    throw new Error(
      "Amount due must be greater than zero."
    );
  }

  /*
   * Collectible schema currently contains only:
   * id, organizationId, category, AY, term,
   * headcount, balanceDue, status, encodedBy.
   *
   * Therefore studentId, studentName, itemDescription,
   * fundAllocation and date are intentionally NOT written
   * here because those fields do not exist in the model.
   */
  await prisma.collectible.create({
    data: {
      organizationId: orgId,
      academicYear: payload.ay,
      term: payload.term,
      category: String(
        payload.category || ""
      ).trim(),
      balanceDue: amountDue,
      status: "Unpaid",
      encodedBy: await getActionUser(),
    },
  });

  revalidatePath(
    `/department/${department}/collectibles`
  );

  return {
    success: true,
    message:
      "Student due successfully assessed.",
  };
}

export async function saveBulkCollectibles(
  department: string,
  records: any[],
  ay: string,
  term: string
) {
  await requireTabAccess(
    "tab-collectibles"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  if (!Array.isArray(records)) {
    throw new Error(
      "Invalid collectible records."
    );
  }

  const prepared =
    records
      .map((r: any) => ({
        organizationId:
          orgId,
        academicYear: ay,
        term,
        category: String(
          r?.category || ""
        ).trim(),
        headcount: Math.max(
          1,
          parseInt(
            r?.headcount,
            10
          ) || 1
        ),
        balanceDue: Math.max(
          0,
          Number.parseFloat(
            r?.total
          ) || 0
        ),
        status:
          "Outstanding",
        encodedBy:
          officerName,
      }))
      .filter(
        (r) => r.category !== ""
      );

  if (prepared.length > 0) {
    await prisma.collectible.createMany(
      {
        data: prepared,
      }
    );
  }

  await logSystemAction(
    orgId,
    officerName,
    "SAVE_COLLECTIBLES",
    `Assessed bulk collectibles across ${prepared.length} categories.`
  );

  revalidatePath(
    `/department/${department}/collectibles`
  );
}

// =========================================================================
// PENALTIES
// =========================================================================

export async function deletePenalty(
  department: string,
  penaltyId: string
) {
  await requireTabAccess("tab-void");

  const orgId =
    await getOrgId(department);

  const result =
    await prisma.penalty.deleteMany({
      where: {
        id: penaltyId,
        organizationId: orgId,
      },
    });

  if (result.count === 0) {
    throw new Error(
      "Penalty record not found."
    );
  }

  revalidatePath(
    `/department/${department}/penalties`
  );

  return {
    success: true,
    message:
      "Penalty record deleted successfully.",
  };
}

export async function recordPenalty(
  department: string,
  data: {
    date: string;
    studentId: string;
    studentName?: string;
    activity: string;
    hoursLate: number;
    ratePerHour: number;
    fineAmount: number;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-penalties"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const date = parseDate(
    data.date,
    "penalty date"
  );

  const hoursLate =
    Number(data.hoursLate);

  const ratePerHour =
    money(
      data.ratePerHour,
      "Rate per hour"
    );

  const fineAmount =
    money(
      data.fineAmount,
      "Fine amount"
    );

  if (
    !Number.isFinite(hoursLate) ||
    hoursLate < 0
  ) {
    throw new Error(
      "Hours late must be a valid non-negative number."
    );
  }

  if (fineAmount <= 0) {
    throw new Error(
      "Fine amount must be greater than zero."
    );
  }

  const penaltyId =
    generateReference("PEN");

  await prisma.penalty.create({
    data: {
      organizationId: orgId,
      penaltyId,
      academicYear: data.ay,
      term: data.term,
      date,
      studentId:
        String(
          data.studentId || ""
        ).trim() || null,
      studentName:
        String(
          data.studentName || ""
        ).trim() || "Unknown",
      activity:
        String(
          data.activity || ""
        ).trim(),
      hoursLate,
      ratePerHour,
      fineAmount,
      status: "Unsettled",
      encodedBy: officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    "RECORD_PENALTY",
    `Assessed ₱${fineAmount.toFixed(
      2
    )} fine (${hoursLate} hrs) to ${
      data.studentName || "Unknown"
    } for ${data.activity}.`
  );

  revalidatePath(
    `/department/${department}/penalties`
  );
  revalidatePath(
    `/department/${department}`
  );
}

export async function settlePenaltyCommunityService(
  department: string,
  data: {
    penaltyId: string;
    hoursRendered: number;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-penalties"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const hoursRendered =
    Number(
      data.hoursRendered
    );

  if (
    !Number.isFinite(
      hoursRendered
    ) ||
    hoursRendered <= 0
  ) {
    throw new Error(
      "Hours rendered must be greater than zero."
    );
  }

  const targetPen =
    await prisma.penalty.findFirst({
      where: {
        penaltyId:
          data.penaltyId,
        organizationId:
          orgId,
      },
    });

  if (!targetPen) {
    throw new Error(
      "Penalty record not found."
    );
  }

  const existingFine =
    Math.max(
      0,
      Number(
        targetPen.fineAmount
      ) || 0
    );

  if (existingFine <= 0) {
    throw new Error(
      "This penalty has already been fully settled."
    );
  }

  const rate = Math.max(
    0,
    Number(
      targetPen.ratePerHour
    ) || 50
  );

  const deductionPesos =
    Math.round(
      hoursRendered *
        rate *
        100
    ) / 100;

  const remainingFine =
    Math.max(
      0,
      Math.round(
        (existingFine -
          deductionPesos) *
          100
      ) / 100
    );

  const newStatus =
    remainingFine === 0
      ? `Settled (Community Service - ${hoursRendered} hrs rendered)`
      : `Partially Served (${hoursRendered} hrs served, ₱${deductionPesos.toFixed(
          2
        )} deducted)`;

  await prisma.penalty.update({
    where: {
      id: targetPen.id,
    },
    data: {
      fineAmount:
        remainingFine,
      status:
        newStatus,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    "SETTLE_PENALTY_SERVICE",
    `Applied ${hoursRendered} hrs community service to penalty [${data.penaltyId}]. Status: ${newStatus}`
  );

  revalidatePath(
    `/department/${department}/penalties`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// CASH ADVANCE
// =========================================================================

export async function issueCashAdvance(
  department: string,
  data: {
    requestor: string;
    purpose: string;
    fundSource: string;
    amount: number;
    dateIssued: string;
    expectedReturnDate: string;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-advances"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const amount =
    money(
      data.amount,
      "Cash advance amount"
    );

  if (amount <= 0) {
    throw new Error(
      "Cash advance amount must be greater than zero."
    );
  }

  const dateIssued =
    parseDate(
      data.dateIssued,
      "date issued"
    );

  const expectedReturnDate =
    parseDate(
      data.expectedReturnDate,
      "expected return date"
    );

  const advanceId =
    generateReference("CA");

  await prisma.cashAdvance.create({
    data: {
      organizationId: orgId,
      advanceId,
      academicYear: data.ay,
      term: data.term,
      requestor:
        String(
          data.requestor || ""
        ).trim(),
      purpose:
        String(
          data.purpose || ""
        ).trim() || null,
      fundSource:
        String(
          data.fundSource || ""
        ).trim(),
      amountApproved:
        amount,
      dateIssued,
      expectedReturnDate,
      status:
        "Pending Liquidation",
      encodedBy:
        officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    "ISSUE_ADVANCE",
    `Issued ₱${amount.toFixed(
      2
    )} cash advance [${advanceId}] to ${data.requestor} from ${data.fundSource}.`
  );

  revalidatePath(
    `/department/${department}/advances`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// PAYMENT HELPER
// =========================================================================

async function validateStudentOwnership(
  organizationId: string,
  studentDbId?: string | null
) {
  const cleanId =
    String(
      studentDbId || ""
    ).trim();

  if (!cleanId) {
    return null;
  }

  const student =
    await prisma.student.findFirst({
      where: {
        id: cleanId,
        organizationId,
      },
      select: {
        id: true,
        studentId: true,
        fullName: true,
        email: true,
      },
    });

  if (!student) {
    throw new Error(
      "Selected student does not belong to this department."
    );
  }

  return student;
}

/**
 * Calculates historical valid payments for the same student + item.
 *
 * Collection.studentId is the Student.id foreign key.
 */
async function getPreviouslyPaid(
  organizationId: string,
  studentDbId: string | null | undefined,
  studentName: string,
  academicYear: string,
  term: string,
  itemDescription: string
) {
  const cleanStudentId =
    String(
      studentDbId || ""
    ).trim();

  const cleanStudentName =
    String(
      studentName || ""
    ).trim();

  const cleanDescription =
    String(
      itemDescription || ""
    ).trim();

  if (!cleanDescription) {
    return 0;
  }

  const rows =
    await prisma.collection.findMany({
      where: {
        organizationId,
        academicYear,
        term,
        itemDescription:
          cleanDescription,
        ...(cleanStudentId
          ? {
              studentId:
                cleanStudentId,
            }
          : {
              studentId: null,
              studentName:
                cleanStudentName,
            }),
      },
      select: {
        amountPaid: true,
        paymentType: true,
        status: true,
      },
    });

  return rows
    .filter(
      (row) =>
        !isVoidedRecord(row)
    )
    .reduce(
      (sum, row) =>
        sum +
        (Number(
          row.amountPaid
        ) || 0),
      0
    );
}

// =========================================================================
// COLLECTION
// =========================================================================

export async function recordCollection(
  department: string,
  data: {
    orNumber: string;
    studentId: string;
    studentName: string;
    category: string;
    itemDescription: string;
    paymentType: string;
    amountPaid: number;
    standardRate: number;
    fundAllocation: string;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-payment"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const studentDbId =
    String(
      data.studentId || ""
    ).trim() || null;

  await validateStudentOwnership(
    orgId,
    studentDbId
  );

  const paid =
    money(
      data.amountPaid,
      "Payment amount"
    );

  const rate =
    money(
      data.standardRate,
      "Standard rate"
    );

  if (paid <= 0) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  if (rate <= 0) {
    throw new Error(
      "The payment has no valid standard rate."
    );
  }

  const itemDescription =
    String(
      data.itemDescription || ""
    ).trim();

  const category =
    String(
      data.category || ""
    ).trim();

  if (!itemDescription) {
    throw new Error(
      "Item description is required."
    );
  }

  const alreadyPaid =
    await getPreviouslyPaid(
      orgId,
      studentDbId,
      data.studentName,
      data.ay,
      data.term,
      itemDescription
    );

  const remainingBeforePayment =
    Math.max(
      0,
      Math.round(
        (rate - alreadyPaid) *
          100
      ) / 100
    );

  if (
    remainingBeforePayment <=
    0
  ) {
    throw new Error(
      `This assessment has already been fully paid at ₱${rate.toFixed(
        2
      )}.`
    );
  }

  if (
    paid >
    remainingBeforePayment
  ) {
    throw new Error(
      `Payment amount ₱${paid.toFixed(
        2
      )} exceeds the remaining balance of ₱${remainingBeforePayment.toFixed(
        2
      )}.`
    );
  }

  const newTotalPaid =
    alreadyPaid + paid;

  const balanceDue =
    Math.max(
      0,
      Math.round(
        (rate -
          newTotalPaid) *
          100
      ) / 100
    );

  const actualPaymentType =
    balanceDue === 0
      ? "Full Payment"
      : String(
          data.paymentType ||
            ""
        ).trim() ||
        "Partial Payment";

  await prisma.collection.create({
    data: {
      organizationId:
        orgId,
      academicYear:
        data.ay,
      term:
        data.term,
      orNumber:
        String(
          data.orNumber || ""
        ).trim(),
      studentId:
        studentDbId,
      studentName:
        String(
          data.studentName || ""
        ).trim(),
      category,
      itemDescription,
      paymentType:
        actualPaymentType,
      standardRate:
        rate,
      amountPaid:
        paid,
      balanceDue,
      fundAllocation:
        String(
          data.fundAllocation ||
            ""
        ).trim(),
      status: "Valid",
      encodedBy:
        officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    "RECORD_COLLECTION",
    `Collected ₱${paid.toFixed(
      2
    )} from ${data.studentName} for ${itemDescription} [OR: ${data.orNumber}].`
  );

  revalidatePath(
    `/department/${department}/collections`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// PAYMENT
// =========================================================================

export async function recordPayment(
  department: string,
  data: {
    orNumber: string;
    date: string;
    studentId: string;
    studentName: string;
    studentEmail?: string;
    category: string;
    itemDescription: string;
    paymentType: string;
    standardRate: number;
    amountPaid: number;
    fundAllocation: string;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-payment"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const studentDbId =
    String(
      data.studentId || ""
    ).trim() || null;

  await validateStudentOwnership(
    orgId,
    studentDbId
  );

  const paid =
    money(
      data.amountPaid,
      "Payment amount"
    );

  const rate =
    money(
      data.standardRate,
      "Standard rate"
    );

  if (paid <= 0) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  if (rate <= 0) {
    throw new Error(
      "The payment has no valid standard rate."
    );
  }

  const date =
    parseDate(
      data.date,
      "payment date"
    );

  const category =
    String(
      data.category || ""
    ).trim();

  const itemDescription =
    String(
      data.itemDescription || ""
    ).trim();

  const studentName =
    String(
      data.studentName || ""
    ).trim();

  if (!studentDbId) {
    throw new Error(
      "A valid student record is required for payment."
    );
  }

  if (!itemDescription) {
    throw new Error(
      "Item description is required."
    );
  }

  const alreadyPaid =
    await getPreviouslyPaid(
      orgId,
      studentDbId,
      studentName,
      data.ay,
      data.term,
      itemDescription
    );

  const remainingBeforePayment =
    Math.max(
      0,
      Math.round(
        (rate -
          alreadyPaid) *
          100
      ) / 100
    );

  if (
    remainingBeforePayment <=
    0
  ) {
    throw new Error(
      `This assessment has already been fully paid at ₱${rate.toFixed(
        2
      )}.`
    );
  }

  if (
    paid >
    remainingBeforePayment
  ) {
    throw new Error(
      `Payment amount ₱${paid.toFixed(
        2
      )} cannot exceed the remaining balance of ₱${remainingBeforePayment.toFixed(
        2
      )}.`
    );
  }

  const newTotalPaid =
    alreadyPaid + paid;

  const balanceDue =
    Math.max(
      0,
      Math.round(
        (rate -
          newTotalPaid) *
          100
      ) / 100
    );

  const actualPaymentType =
    balanceDue === 0
      ? "Full Payment"
      : String(
          data.paymentType ||
            ""
        ).trim() ||
        "Partial Payment";

  await prisma.collection.create({
    data: {
      organizationId:
        orgId,
      academicYear:
        data.ay,
      term:
        data.term,
      date,
      studentId:
        studentDbId,
      studentName,
      orNumber:
        String(
          data.orNumber || ""
        ).trim(),
      category,
      itemDescription,
      paymentType:
        actualPaymentType,
      standardRate:
        rate,
      amountPaid:
        paid,
      balanceDue,
      fundAllocation:
        String(
          data.fundAllocation ||
            ""
        ).trim(),
      status:
        "Valid",
      encodedBy:
        officerName,
    },
  });

  await logSystemAction(
    orgId,
    officerName,
    "RECORD_PAYMENT",
    `Recorded payment of ₱${paid.toFixed(
      2
    )} from ${studentName} [OR: ${data.orNumber}] for ${itemDescription}.`
  );

  revalidatePath(
    `/department/${department}/collections`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// OTP LOGIN
// =========================================================================

export async function requestOtp(
  department: string,
  email: string
) {
  const cleanDepartment = normalizeDepartment(department);
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }

  // NEW: Fetch the full organization record, not just the ID
  const org = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });

  if (!org) {
    throw new Error("Department or Organization not found.");
  }

  const orgId = org.id;

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: orgId,
      email: cleanEmail,
    },
  });

  if (!user) {
    throw new Error(
      "This account is not registered or does not belong to this department."
    );
  }

  if (user.status !== "Active") {
    throw new Error(
      "This account is currently inactive."
    );
  }

  const cookieStore =
    await cookies();

  const lockoutCookie =
    cookieStore.get(
      "fcu_lockout"
    );

  if (lockoutCookie) {
    const lockoutTime =
      Number.parseInt(
        lockoutCookie.value,
        10
      );

    if (
      Number.isFinite(
        lockoutTime
      ) &&
      Date.now() <
        lockoutTime
    ) {
      const remainingMinutes =
        Math.ceil(
          (lockoutTime -
            Date.now()) /
            60000
        );

      throw new Error(
        `Too many failed attempts. Account temporarily locked. Try again in ${remainingMinutes} minute(s).`
      );
    }
  }

  const otpCode =
    crypto
      .randomInt(
        100000,
        1000000
      )
      .toString();

  const hashedCode =
    crypto
      .createHash(
        "sha256"
      )
      .update(otpCode)
      .digest("hex");

  const expiresAt =
    Date.now() +
    5 * 60 * 1000;

  const smtpUser =
    process.env.SMTP_USER;

  const smtpPass =
    process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error(
      "Email service is not configured."
    );
  }

  const transporter =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST ||
        "smtp.gmail.com",
      port: Number(
        process.env.SMTP_PORT ||
          465
      ),
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,},
    });

  // Send first. Only store the OTP if sending succeeds.
  try {
    await transporter.sendMail({
      from: `"CLEAR System" <${smtpUser}>`,
      to: cleanEmail,
      // NEW: Dynamically use the true organization name from the database!
      subject: `[CLEAR System] OTP CODE FOR ${org.name.toUpperCase()}`,
      text: `Your 6-digit One-Time PIN is: ${otpCode}\n\nThis code will expire in 5 minutes.`,
    });
  } catch (error) {
    console.error("SMTP Error:", error);
    throw new Error("Failed to dispatch verification email.");
  }

  const cookieOptions = {
    httpOnly: true,
    secure:
      process.env.NODE_ENV ===
      "production",
    sameSite:
      "lax" as const,
    path: "/",
    maxAge: 300,
  };

  cookieStore.set(
    "fcu_otp_hash",
    `${hashedCode}:${expiresAt}`,
    cookieOptions
  );

  cookieStore.set(
    "fcu_otp_email",
    cleanEmail,
    cookieOptions
  );

  cookieStore.set(
    "fcu_otp_department",
    cleanDepartment,
    cookieOptions
  );

  cookieStore.set(
    "fcu_otp_strikes",
    "0",
    cookieOptions
  );

  return {
    success: true,
    message:
      "Verification code sent successfully.",
  };
}

export async function verifyOtp(
  department: string,
  email: string,
  submittedOtp: string
) {
  const cleanDepartment =
    normalizeDepartment(
      department
    );

  const cleanEmail =
    String(
      email || ""
    )
      .trim()
      .toLowerCase();

  const cleanOtp =
    String(
      submittedOtp || ""
    ).trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error(
      "Verification code must be exactly 6 digits."
    );
  }

  const cookieStore =
    await cookies();

  const otpCookie =
    cookieStore.get(
      "fcu_otp_hash"
    );

  const emailCookie =
    cookieStore.get(
      "fcu_otp_email"
    );

  const departmentCookie =
    cookieStore.get(
      "fcu_otp_department"
    );

  const strikesCookie =
    cookieStore.get(
      "fcu_otp_strikes"
    );

  if (
    !otpCookie ||
    !emailCookie ||
    !departmentCookie
  ) {
    throw new Error(
      "Verification session expired. Please request a new code."
    );
  }

  if (
    emailCookie.value !==
    cleanEmail
  ) {
    throw new Error(
      "Email mismatch. Please request a new code."
    );
  }

  if (
    departmentCookie.value !==
    cleanDepartment
  ) {
    throw new Error(
      "Department mismatch. Please request a new verification code."
    );
  }

  let currentStrikes =
    strikesCookie
      ? Number.parseInt(
          strikesCookie.value,
          10
        )
      : 0;

  if (
    !Number.isFinite(
      currentStrikes
    )
  ) {
    currentStrikes = 0;
  }

  if (currentStrikes >= 5) {
    const lockoutUntil =
      Date.now() +
      10 * 60 * 1000;

    cookieStore.set(
      "fcu_lockout",
      lockoutUntil.toString(),
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      }
    );

    throw new Error(
      "Maximum verification attempts exceeded. Account locked for 10 minutes."
    );
  }

  const [
    storedHash,
    expiryStr,
  ] =
    otpCookie.value.split(
      ":"
    );

  const expiresAt =
    Number.parseInt(
      expiryStr,
      10
    );

  if (
    !storedHash ||
    !Number.isFinite(
      expiresAt
    )
  ) {
    throw new Error(
      "Invalid verification session. Please request a new code."
    );
  }

  if (
    Date.now() >
    expiresAt
  ) {
    cookieStore.delete(
      "fcu_otp_hash"
    );
    cookieStore.delete(
      "fcu_otp_email"
    );
    cookieStore.delete(
      "fcu_otp_department"
    );
    cookieStore.delete(
      "fcu_otp_strikes"
    );

    throw new Error(
      "Verification code has expired. Please request a new one."
    );
  }

  const submittedHash =
    crypto
      .createHash(
        "sha256"
      )
      .update(cleanOtp)
      .digest("hex");

  const storedBuffer =
    Buffer.from(
      storedHash,
      "utf8"
    );

  const submittedBuffer =
    Buffer.from(
      submittedHash,
      "utf8"
    );

  let valid = false;

  if (
    storedBuffer.length ===
    submittedBuffer.length
  ) {
    valid =
      crypto.timingSafeEqual(
        storedBuffer,
        submittedBuffer
      );
  }

  if (!valid) {
    currentStrikes += 1;

    cookieStore.set(
      "fcu_otp_strikes",
      currentStrikes.toString(),
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 300,
      }
    );

    if (
      currentStrikes >=
      5
    ) {
      const lockoutUntil =
        Date.now() +
        10 * 60 * 1000;

      cookieStore.set(
        "fcu_lockout",
        lockoutUntil.toString(),
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV ===
            "production",
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        }
      );

      throw new Error(
        "Maximum verification attempts exceeded. Account locked for 10 minutes."
      );
    }

    throw new Error(
      `Invalid verification code. ${
        5 - currentStrikes
      } attempt(s) remaining.`
    );
  }

  // Still pre-authentication.
  const orgId =
    await resolveOrganizationId(
      cleanDepartment
    );

  const user =
    await prisma.tenantUser.findFirst({
      where: {
        organizationId:
          orgId,
        email:
          cleanEmail,
      },
    });

  if (!user) {
    throw new Error(
      "User record not found."
    );
  }

  if (user.status !== "Active") {
    throw new Error(
      "This account is currently inactive."
    );
  }

  cookieStore.delete(
    "fcu_otp_hash"
  );
  cookieStore.delete(
    "fcu_otp_email"
  );
  cookieStore.delete(
    "fcu_otp_department"
  );
  cookieStore.delete(
    "fcu_otp_strikes"
  );
  cookieStore.delete(
    "fcu_lockout"
  );

  // Preserved because your existing application uses it.
  cookieStore.set(
    "fcu_session",
    user.id,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    }
  );

  return {
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      allowedTabs:
        parseAllowedTabs(
          user.allowedTabs
        ),
    },
  };
}

// =========================================================================
// ONLINE REMITTANCE
// =========================================================================

export async function invalidateOnlineRemittance(
  department: string,
  remittanceId: string
) {
  await requireTabAccess(
    "tab-remittances"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const remittance =
    await prisma.onlineRemittance.findFirst(
      {
        where: {
          id: remittanceId,
          organizationId: orgId,
        },
      }
    );

  if (!remittance) {
    throw new Error(
      "Online remittance record not found."
    );
  }

  const status =
    String(
      remittance.status || ""
    ).toUpperCase();

  if (
    status === "VERIFIED"
  ) {
    throw new Error(
      "A verified remittance cannot be invalidated from the pending queue."
    );
  }

  await prisma.onlineRemittance.deleteMany(
    {
      where: {
        id: remittance.id,
        organizationId:
          orgId,
      },
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "INVALIDATE_REMITTANCE",
    `Invalidated remittance [Ref: ${remittance.referenceNumber}] from ${remittance.studentName}.`
  );

  revalidatePath(
    `/department/${department}/remittances`
  );

  return {
    success: true,
    message:
      "Remittance submission marked as invalid and removed from queue.",
  };
}

export async function verifyOnlineRemittance(
  department: string,
  data: {
    remittanceId: string;
    orNumber: string;
    studentId: string;
    studentName: string;
    particulars: string;
    amount: number;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-remittances"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const orNumber =
    String(
      data.orNumber || ""
    ).trim();

  if (!orNumber) {
    throw new Error(
      "OR number is required."
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const remittance =
        await tx.onlineRemittance.findFirst(
          {
            where: {
              id:
                data.remittanceId,
              organizationId:
                orgId,
            },
          }
        );

      if (!remittance) {
        throw new Error(
          "Online remittance record not found."
        );
      }

      const currentStatus =
        String(
          remittance.status ||
            ""
        ).toUpperCase();

      if (
        currentStatus ===
        "VERIFIED"
      ) {
        throw new Error(
          "This remittance has already been verified."
        );
      }

      const amount =
        Math.max(
          0,
          Number(
            remittance.amountPaid
          ) || 0
        );

      if (amount <= 0) {
        throw new Error(
          "The remittance contains an invalid amount."
        );
      }

      // Collection.studentId is FK -> Student.id.
      const studentDbId =
        remittance.studentId
          ? String(
              remittance.studentId
            ).trim()
          : null;

      if (studentDbId) {
        const student =
          await tx.student.findFirst(
            {
              where: {
                id:
                  studentDbId,
                organizationId:
                  orgId,
              },
              select: {
                id: true,
              },
            }
          );

        if (!student) {
          throw new Error(
            "The remittance student does not belong to this department."
          );
        }
      }

      await tx.onlineRemittance.update(
        {
          where: {
            id:
              remittance.id,
          },
          data: {
            status:
              "Verified",
            reviewedBy:
              officerName,
            orNumber,
          },
        }
      );

      await tx.collection.create(
        {
          data: {
            organizationId:
              orgId,
            academicYear:
              remittance.academicYear,
            term:
              remittance.term,
            date:
              new Date(),
            studentId:
              studentDbId,
            studentName:
              remittance.studentName,
            orNumber,
            category:
              remittance.category ||
              "Online Remittance",
            itemDescription:
              remittance.itemDescription,
            paymentType:
              "Full Payment",
            standardRate:
              amount,
            amountPaid:
              amount,
            balanceDue:
              0,
            fundAllocation:
              "New Accounts (Current Operations)",
            status:
              "Valid",
            encodedBy:
              officerName,
          },
        }
      );
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "VERIFY_REMITTANCE",
    `Verified online remittance for remittance [${data.remittanceId}] and issued OR: ${orNumber}.`
  );

  revalidatePath(
    `/department/${department}/remittances`
  );
  revalidatePath(
    `/department/${department}/collections`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
  revalidatePath(
    `/department/${department}`
  );
}

export async function submitOnlineRemittance(department: string, formData: FormData) {
  // 1. Reconstruct the 'data' object to ensure all your existing validation and DB logic works
  const data = {
    studentId: formData.get('studentId') as string,
    studentName: formData.get('studentName') as string,
    email: formData.get('email') as string,
    paymentChannel: formData.get('paymentChannel') as string,
    referenceNo: formData.get('referenceNo') as string,
    particulars: formData.get('particulars') as string,
    amount: parseFloat(formData.get('amount') as string),
    ay: formData.get('ay') as string,
    term: formData.get('term') as string,
    proofBase64: null as string | null,
  };

  // 2. Safely extract and process the file
  const receiptFile = formData.get('receipt') as File | null;
  if (receiptFile) {
    const arrayBuffer = await receiptFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Convert back to base64 on the server to maintain compatibility with your database schema
    data.proofBase64 = `data:${receiptFile.type};base64,${buffer.toString('base64')}`;
  }

  // PUBLIC:
  // Do not use getOrgId().
  const orgId = await resolveOrganizationId(department);

  const cleanEmail = String(data.email || "").trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }

  const amount = money(data.amount, "Online remittance amount");

  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const submissionId = generateReference("SUB");

  await prisma.onlineRemittance.create({
    data: {
      organizationId: orgId,
      submissionId,
      academicYear: data.ay,
      term: data.term,
      studentId: String(data.studentId || "").trim() || null,
      studentName: String(data.studentName || "").trim(),
      studentEmail: cleanEmail,
      paymentChannel: String(data.paymentChannel || "").trim(),
      referenceNumber: String(data.referenceNo || "").trim(),
      category: "Online Remittance",
      itemDescription: String(data.particulars || "").trim(),
      paymentMode: "Online",
      amountPaid: amount,
      proofUrl: data.proofBase64 || null,
      status: "Pending Verification",
    },
  });

  await logSystemAction(
    orgId,
    "Public Submission",
    "SUBMIT_REMITTANCE",
    `Received ₱${amount.toFixed(2)} online payment proof from ${data.studentName} via ${data.paymentChannel}.`
  );

  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/clearance`);
}

export async function submitOnlineRemittanceDirect(
  department: string,
  payload: {
    studentId: string;
    studentName: string;
    email: string;
    channel: string;
    referenceNo: string;
    collectionType: string;
    paymentMode: string;
    amount: number;
    proofBase64: string;
    ay: string;
    term: string;
  }
) {
  return submitOnlineRemittance(
    department,
    {
      studentId:
        payload.studentId,
      studentName:
        payload.studentName,
      email:
        payload.email,
      paymentChannel:
        payload.channel,
      referenceNo:
        payload.referenceNo,
      particulars:
        payload.collectionType,
      amount:
        payload.amount,
      proofBase64:
        payload.proofBase64,
      ay:
        payload.ay,
      term:
        payload.term,
    }
  );
}

// =========================================================================
// REMITTANCE BATCH
// =========================================================================

export async function submitRemittanceBatch(
  department: string,
  data: {
    collectionIds: string[];
    depositSlipOr: string;
    remitDate: string;
    depositedBy: string;
    remarks: string;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-remittances"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  if (
    !Array.isArray(
      data.collectionIds
    ) ||
    data.collectionIds.length === 0
  ) {
    throw new Error(
      "No collection records were selected."
    );
  }

  const depositSlipOr =
    String(
      data.depositSlipOr || ""
    ).trim();

  if (!depositSlipOr) {
    throw new Error(
      "Deposit slip / OR number is required."
    );
  }

  parseDate(
    data.remitDate,
    "remittance date"
  );

  const collections =
    await prisma.collection.findMany(
      {
        where: {
          organizationId:
            orgId,
          academicYear:
            data.ay,
          term:
            data.term,
          id: {
            in:
              data.collectionIds,
          },
        },
        select: {
          id: true,
          status: true,
        },
      }
    );

  if (
    collections.length !==
    data.collectionIds.length
  ) {
    throw new Error(
      "One or more selected collection records are invalid or belong to another accounting period."
    );
  }

  const alreadyRemitted =
    collections.some(
      (row) =>
        String(
          row.status || ""
        )
          .toUpperCase()
          .includes("REMITTED")
    );

  if (alreadyRemitted) {
    throw new Error(
      "One or more selected collections have already been remitted."
    );
  }

  await prisma.collection.updateMany(
    {
      where: {
        organizationId:
          orgId,
        academicYear:
          data.ay,
        term:
          data.term,
        id: {
          in:
            data.collectionIds,
        },
      },
      data: {
        status: `Remitted (Slip #${depositSlipOr})`,
      },
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "SUBMIT_REMITTANCE_BATCH",
    `Marked ${data.collectionIds.length} collections as remitted (Slip: ${depositSlipOr}).`
  );

  revalidatePath(
    `/department/${department}/remittances`
  );
  revalidatePath(
    `/department/${department}/collections`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// STUDENTS
// =========================================================================

export async function upsertStudent(
  department: string,
  data: {
    studentId: string;
    fullName: string;
    email: string;
  }
) {
  await requireTabAccess(
    "tab-students"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const cleanStudentId =
    String(
      data.studentId || ""
    ).trim();

  const cleanFullName =
    String(
      data.fullName || ""
    ).trim();

  const cleanEmail =
    String(
      data.email || ""
    ).trim();

  if (!cleanStudentId) {
    throw new Error(
      "Student ID is required."
    );
  }

  if (!cleanFullName) {
    throw new Error(
      "Student name is required."
    );
  }

  const existing =
    await prisma.student.findFirst(
      {
        where: {
          organizationId:
            orgId,
          studentId:
            cleanStudentId,
        },
      }
    );

  if (existing) {
    await prisma.student.update({
      where: {
        id:
          existing.id,
      },
      data: {
        fullName:
          cleanFullName,
        email:
          cleanEmail || null,
      },
    });
  } else {
    await prisma.student.create({
      data: {
        organizationId:
          orgId,
        studentId:
          cleanStudentId,
        fullName:
          cleanFullName,
        email:
          cleanEmail || null,
        yearLevel:
          "N/A",
      },
    });
  }

  await logSystemAction(
    orgId,
    officerName,
    existing
      ? "UPDATE_STUDENT"
      : "ADD_STUDENT",
    `${
      existing
        ? "Modified"
        : "Registered"
    } profile for ${cleanFullName} (${cleanStudentId}).`
  );

  revalidatePath(
    `/department/${department}/students`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
}

export async function deleteStudent(
  department: string,
  studentId: string
) {
  await requireTabAccess(
    "tab-students"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const cleanStudentId =
    String(
      studentId || ""
    ).trim();

  if (!cleanStudentId) {
    throw new Error(
      "Student ID is required."
    );
  }

  const existing =
    await prisma.student.findFirst(
      {
        where: {
          organizationId:
            orgId,
          studentId:
            cleanStudentId,
        },
      }
    );

  if (existing) {
    await prisma.student.delete({
      where: {
        id:
          existing.id,
      },
    });

    await logSystemAction(
      orgId,
      officerName,
      "DELETE_STUDENT",
      `Permanently removed student record for ${existing.fullName} (${existing.studentId}).`
    );
  }

  revalidatePath(
    `/department/${department}/students`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
}

// =========================================================================
// AUDIT / LIQUIDATION
// =========================================================================

export async function recordAudit(
  department: string,
  data: {
    date: string;
    advanceId: string;
    requestor: string;
    fundSource: string;
    budgetRequested: number;
    totalExpense: number;
    items: {
      qty: number;
      orsi: string;
      desc: string;
      subTotal: number;
    }[];
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-audit"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const date =
    parseDate(
      data.date,
      "audit date"
    );

  const budgetRequested =
    money(
      data.budgetRequested,
      "Budget requested"
    );

  const totalExpense =
    money(
      data.totalExpense,
      "Total expense"
    );

  if (totalExpense <= 0) {
    throw new Error(
      "Total expense must be greater than zero."
    );
  }

  if (
    !Array.isArray(
      data.items
    )
  ) {
    throw new Error(
      "Expense items are invalid."
    );
  }

  let itemTotal = 0;

  for (const item of data.items) {
    const qty =
      Number(item.qty);

    const subTotal =
      money(
        item.subTotal,
        "Expense subtotal"
      );

    if (
      !Number.isInteger(
        qty
      ) ||
      qty <= 0
    ) {
      throw new Error(
        "Expense quantity must be a positive whole number."
      );
    }

    itemTotal +=
      subTotal;
  }

  itemTotal =
    Math.round(
      itemTotal * 100
    ) / 100;

  if (
    Math.abs(
      itemTotal -
        totalExpense
    ) > 0.01
  ) {
    throw new Error(
      `Expense item total ₱${itemTotal.toFixed(
        2
      )} does not match total expense ₱${totalExpense.toFixed(
        2
      )}.`
    );
  }

  const auditId =
    generateReference("AUD");

  const variance =
    Math.round(
      (budgetRequested -
        totalExpense) *
        100
    ) / 100;

  const cashReturn =
    variance > 0
      ? variance
      : 0;

  const reimbursement =
    variance < 0
      ? Math.abs(variance)
      : 0;

  const caRef =
    data.advanceId ||
    "Direct Expense (No CA)";

  await prisma.$transaction(
    async (tx) => {
      if (data.advanceId) {
        const advance =
          await tx.cashAdvance.findFirst(
            {
              where: {
                organizationId:
                  orgId,
                advanceId:
                  data.advanceId,
              },
            }
          );

        if (!advance) {
          throw new Error(
            "Cash advance record not found."
          );
        }

        const status =
          String(
            advance.status ||
              ""
          ).toUpperCase();

        if (
          status.includes(
            "LIQUIDATED"
          )
        ) {
          throw new Error(
            "This cash advance has already been liquidated."
          );
        }
      }

      await tx.audit.create({
        data: {
          organizationId:
            orgId,
          auditId,
          academicYear:
            data.ay,
          term:
            data.term,
          date,
          referenceCaId:
            caRef,
          requestor:
            String(
              data.requestor ||
                ""
            ).trim(),
          fundSource:
            String(
              data.fundSource ||
                ""
            ).trim(),
          budgetRequested,
          totalExpense,
          varianceReturn:
            cashReturn,
          reimbursementDue:
            reimbursement,
          status:
            "Audited & Verified",
          encodedBy:
            officerName,
        },
      });

      for (const item of data.items) {
        await tx.expenseItem.create({
          data: {
            organizationId:
              orgId,
            auditId,
            orSiNumber:
              String(
                item.orsi || ""
              ).trim() ||
              null,
            qty: Number(
              item.qty
            ),
            description:
              String(
                item.desc ||
                  ""
              ).trim(),
            subTotal:
              money(
                item.subTotal,
                "Expense subtotal"
              ),
          },
        });
      }

      if (data.advanceId) {
        const advance =
          await tx.cashAdvance.findFirst(
            {
              where: {
                organizationId:
                  orgId,
                advanceId:
                  data.advanceId,
              },
            }
          );

        if (!advance) {
          throw new Error(
            "Cash advance record not found."
          );
        }

        await tx.cashAdvance.update(
          {
            where: {
              id:
                advance.id,
            },
            data: {
              status:
                "Liquidated",
            },
          }
        );
      }
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "RECORD_LIQUIDATION",
    `Verified liquidation [${auditId}] for ${data.requestor} totaling ₱${totalExpense.toFixed(
      2
    )}.`
  );

  revalidatePath(
    `/department/${department}/liquidations`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// FUND TRANSFERS
// =========================================================================

export async function transferFunds(
  department: string,
  data: {
    fromFund: string;
    toFund: string;
    amount: number;
    reason: string;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-transfer"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const fromFund =
    String(
      data.fromFund || ""
    ).trim();

  const toFund =
    String(
      data.toFund || ""
    ).trim();

  const amount =
    money(
      data.amount,
      "Transfer amount"
    );

  if (!fromFund || !toFund) {
    throw new Error(
      "Both source and destination funds are required."
    );
  }

  if (
    fromFund.toLowerCase() ===
    toFund.toLowerCase()
  ) {
    throw new Error(
      "Source and destination funds must be different."
    );
  }

  if (amount <= 0) {
    throw new Error(
      "Transfer amount must be greater than zero."
    );
  }

  await prisma.fundTransfer.create(
    {
      data: {
        organizationId:
          orgId,
        academicYear:
          data.ay,
        term:
          data.term,
        sourceFund:
          fromFund,
        destinationFund:
          toFund,
        amount,
        reason:
          String(
            data.reason || ""
          ).trim(),
        encodedBy:
          officerName,
      },
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "TRANSFER_FUNDS",
    `Realigned ₱${amount.toFixed(
      2
    )} from ${fromFund} to ${toFund}.`
  );

  revalidatePath(
    `/department/${department}/realign`
  );
  revalidatePath(
    `/department/${department}`
  );
}

export async function carryOverTermBalance(
  department: string,
  data: {
    sourceAY: string;
    sourceTerm: string;
    destAY: string;
    destTerm: string;
    amount: number;
    reason: string;
  }
) {
  await requireTabAccess(
    "tab-transfer"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  const amount =
    money(
      data.amount,
      "Carry-over amount"
    );

  if (amount <= 0) {
    throw new Error(
      "Carry-over amount must be greater than zero."
    );
  }

  if (
    data.sourceAY ===
      data.destAY &&
    data.sourceTerm ===
      data.destTerm
  ) {
    throw new Error(
      "Source and destination accounting periods must be different."
    );
  }

  await prisma.fundTransfer.create(
    {
      data: {
        organizationId:
          orgId,
        academicYear:
          data.destAY,
        term:
          data.destTerm,
        sourceFund: `${String(
          data.sourceTerm
        ).trim()} (${String(
          data.sourceAY
        ).trim()}) Rollover`,
        destinationFund:
          "General Fund (Carried Over)",
        amount,
        reason:
          String(
            data.reason || ""
          ).trim(),
        encodedBy:
          officerName,
      },
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "CARRY_OVER",
    `Carried over ₱${amount.toFixed(
      2
    )} from ${data.sourceTerm} into ${data.destTerm} General Fund.`
  );

  revalidatePath(
    `/department/${department}/realign`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// UPDATE MY EMAIL
// =========================================================================

export async function updateMyEmail(
  department: string,
  newEmail: string
) {
  const session = await auth();

  const sessionUser =
    session?.user as
      | {
          email?: string;
        }
      | undefined;

  if (!sessionUser?.email) {
    throw new Error(
      "Unauthorized: No active session found."
    );
  }

  const orgId =
    await getOrgId(department);

  const cleanCurrentEmail =
    sessionUser.email
      .trim()
      .toLowerCase();

  const cleanNewEmail =
    String(
      newEmail || ""
    )
      .trim()
      .toLowerCase();

  if (
    !cleanNewEmail ||
    !cleanNewEmail.includes("@")
  ) {
    throw new Error(
      "Please provide a valid email address."
    );
  }

  const user =
    await prisma.tenantUser.findFirst(
      {
        where: {
          organizationId:
            orgId,
          email:
            cleanCurrentEmail,
        },
      }
    );

  if (!user) {
    throw new Error(
      "User record not found in this department."
    );
  }

  const existing =
    await prisma.tenantUser.findFirst(
      {
        where: {
          organizationId:
            orgId,
          email:
            cleanNewEmail,
        },
      }
    );

  if (
    existing &&
    existing.id !== user.id
  ) {
    throw new Error(
      "This email is already registered by another account."
    );
  }

  await prisma.tenantUser.update({
    where: {
      id:
        user.id,
    },
    data: {
      email:
        cleanNewEmail,
    },
  });

  revalidatePath(
    `/department/${department}`
  );

  return {
    success: true,
    message:
      "Email updated successfully! Please sign out and sign back in to apply changes fully.",
  };
}

// =========================================================================
// FINANCIAL ENGINE
// =========================================================================

export async function getDepartmentFinancials(
  organizationId: string,
  ay: string,
  term: string,
  isPublic: boolean = false
) {
	if (!isPublic) {
    await requireOrganizationAccess(organizationId); // Or however it is formatted internally
  }


  const [
    collections,
    audits,
    cashAdvances,
    explicitCollectibles,
    initialFunds,
    students,
    enrollments,
    collectionSetups,
    fundTransfers,
  ] = await Promise.all([
    prisma.collection.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
          },
        },
      },
    }),

    prisma.audit.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.cashAdvance.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
      orderBy: {
        dateIssued:
          "desc",
      },
    }),

    prisma.collectible.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.fund.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.student.findMany({
      where: {
        organizationId,
      },
    }),

    prisma.enrollment.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
          },
        },
      },
    }),

    prisma.collectionSetup.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),

    prisma.fundTransfer.findMany({
      where: {
        organizationId,
        academicYear: ay,
        term,
      },
    }),
  ]);

  // =========================================================================
  // VALID COLLECTIONS / AUDITS
  // =========================================================================

  const validCollections =
    collections.filter(
      (c: any) =>
        !isVoidedRecord(c)
    );

  const validAudits =
    audits.filter(
      (a: any) => {
        const status =
          String(
            a.status || ""
          ).toUpperCase();

        return (
          !status.includes(
            "VOID"
          ) &&
          !status.includes(
            "CANCEL"
          )
        );
      }
    );

  // =========================================================================
  // LEGACY PACKAGE DEFINITIONS
  // =========================================================================

  const legacyTermPackages: Record<
    string,
    {
      total: number;
      items: {
        name: string;
        rate: number;
        fund: string;
      }[];
    }
  > = {
    "1st Sem": {
      total: 650,
      items: [
        {
          name:
            "JIECEP FCUSC Membership Fee (Student & Institutional)",
          rate: 250,
          fund:
            "JIECEP Membership Fund",
        },
        {
          name:
            "General Orientation/Acquaintance Party",
          rate: 200,
          fund:
            "General Orientation Fund",
        },
        {
          name:
            "COE FCUSR Activities",
          rate: 100,
          fund:
            "FCUSR Activities Fund",
        },
        {
          name:
            "Sports and Cultural Fund",
          rate: 100,
          fund:
            "Sports & Cultural Fund",
        },
      ],
    },

    "2nd Sem": {
      total: 900,
      items: [
        {
          name:
            "JIECEP FCUSC Fund",
          rate: 50,
          fund:
            "JIECEP FCUSC Fund",
        },
        {
          name:
            "JIECEP Week Activities (Local & Regional)",
          rate: 150,
          fund:
            "JIECEP Week Activities Fund",
        },
        {
          name:
            "ECE Grand Ball",
          rate: 650,
          fund:
            "ECE Grandball Fund",
        },
        {
          name:
            "Emergency/Calamity Fund",
          rate: 30,
          fund:
            "Emergency/Calamity Fund",
        },
        {
          name:
            "FCUSR Activities & Projects",
          rate: 20,
          fund:
            "FCUSR Activities Fund",
        },
      ],
    },

    Summer: {
      total: 200,
      items: [
        {
          name:
            "Summer Departmental Operations",
          rate: 150,
          fund:
            "New Accounts (Current Operations)",
        },
        {
          name:
            "Special Activities Fund",
          rate: 50,
          fund:
            "JIECEP Activities Fund",
        },
      ],
    },
  };

  // =========================================================================
  // PACKAGE SETUP
  // =========================================================================

  let pkgTotal = 0;

  const currentPkgItems: {
    name: string;
    rate: number;
    fund: string;
  }[] = [];

  const packageItems =
    collectionSetups.filter(
      (c: any) =>
        c.isPackage !==
        false
    );

  if (
    packageItems.length >
    0
  ) {
    packageItems.forEach(
      (s: any) => {
        const amount =
          Number(
            s.amount
          ) || 0;

        pkgTotal +=
          amount;

        currentPkgItems.push(
          {
            name: String(
              s.name || ""
            ).trim(),
            rate: amount,
            fund: String(
              s.targetFund ||
                ""
            ).trim(),
          }
        );
      }
    );
  } else {
    const fallbackPkg =
      legacyTermPackages[
        term
      ] ||
      legacyTermPackages[
        "1st Sem"
      ];

    pkgTotal =
      fallbackPkg.total;

    currentPkgItems.push(
      ...fallbackPkg.items
    );
  }

  const termPkg = {
    total: pkgTotal,
    items:
      currentPkgItems,
  };

  // =========================================================================
  // FUND NAME
  // =========================================================================

  const getFundName =
    (row: any) => {
      const raw =
        String(
          row.fundAllocation ||
            row.fundSource ||
            row.fundName ||
            row.fund ||
            ""
        ).trim();

      return raw === "" ||
        raw === "undefined" ||
        raw === "null"
        ? "General Fund (Carried Over)"
        : raw;
    };

  // =========================================================================
  // COLLECTION TOTALS
  // =========================================================================

  let grandCollectionTotal =
    0;

  const collectionHierarchy: Record<
    string,
    {
      count: number;
      total: number;
    }
  > = {};

  const distinctStudents: Record<
    string,
    Set<string>
  > = {};

  const collectionsByFund: Record<
    string,
    number
  > = {};

  const addCollectionItem = (
    itemName: string,
    amt: number,
    studentKey: string,
    fund: string
  ) => {
    grandCollectionTotal +=
      amt;

    collectionsByFund[
      fund
    ] =
      (collectionsByFund[
        fund
      ] || 0) + amt;

    if (
      !collectionHierarchy[
        itemName
      ]
    ) {
      collectionHierarchy[
        itemName
      ] = {
        count: 0,
        total: 0,
      };

      distinctStudents[
        itemName
      ] = new Set();
    }

    collectionHierarchy[
      itemName
    ].total += amt;

    if (
      amt > 0 &&
      studentKey
    ) {
      distinctStudents[
        itemName
      ].add(studentKey);
    }
  };

  validCollections.forEach(
    (c: any) => {
      const itemDesc =
        String(
          c.itemDescription ||
            c.category ||
            "General"
        ).trim();

      const amt =
        Number(
          c.amountPaid
        ) || 0;

      /*
       * Because Collection.studentId is Student.id,
       * use c.studentId or the included student.id.
       */
      const studentKey =
        getStudentKey(
          c.studentId ||
            c.student?.id,
          c.student?.fullName ||
            c.studentName,
          String(
            c.orNumber || ""
          )
            .trim()
            .toLowerCase()
        );

      const fund =
        getFundName(c);

      const matchedPkgItem =
        termPkg.items.find(
          (pi: any) =>
            String(
              pi.name || ""
            )
              .trim()
              .toLowerCase() ===
            itemDesc.toLowerCase()
        );

      if (matchedPkgItem) {
        addCollectionItem(
          matchedPkgItem.name,
          amt,
          studentKey,
          matchedPkgItem.fund
        );
      } else if (
        itemDesc.toLowerCase() ===
          "departmental fee package" ||
        itemDesc.toLowerCase() ===
          "departmental fee" ||
        itemDesc.toLowerCase() ===
          "departmental fee package (all items)"
      ) {
        const pkgToUse =
          termPkg.items.length >
          0
            ? termPkg
            : (
                legacyTermPackages[
                  term
                ] ||
                legacyTermPackages[
                  "1st Sem"
                ]
              );

        const pkgTotalRate =
          Number(
            pkgToUse.total
          ) || 0;

        if (
          pkgTotalRate > 0
        ) {
          pkgToUse.items.forEach(
            (pi: any) => {
              const share =
                (Number(
                  pi.rate
                ) /
                  pkgTotalRate) *
                amt;

              addCollectionItem(
                pi.name,
                share,
                studentKey,
                pi.fund
              );
            }
          );
        } else {
          addCollectionItem(
            itemDesc,
            amt,
            studentKey,
            fund
          );
        }
      } else {
        addCollectionItem(
          itemDesc,
          amt,
          studentKey,
          fund
        );
      }
    }
  );

  Object.keys(
    collectionHierarchy
  ).forEach(
    (key) => {
      collectionHierarchy[
        key
      ].count =
        distinctStudents[
          key
        ]?.size || 0;
    }
  );

  // =========================================================================
  // EXPENSES
  // =========================================================================

  let grandExpenseTotal =
    0;

  const expensesByFund: Record<
    string,
    number
  > = {};

  validAudits.forEach(
    (a: any) => {
      const amt =
        Number(
          a.totalExpense
        ) || 0;

      grandExpenseTotal +=
        amt;

      const fund =
        getFundName(a);

      expensesByFund[
        fund
      ] =
        (expensesByFund[
          fund
        ] || 0) + amt;
    }
  );

  // =========================================================================
  // UNLIQUIDATED ADVANCES
  // =========================================================================

  let totalUnliquidated =
    0;

  const unliquidatedAdvances: any[] =
    [];

  const unliquidatedByFund: Record<
    string,
    number
  > = {};

  cashAdvances.forEach(
    (ca: any) => {
      const status =
        String(
          ca.status || ""
        ).toUpperCase();

      /*
       * Supports both:
       * - Active (Unliquidated)
       * - Pending Liquidation
       *
       * because your schema default and action-created
       * status values are different.
       */
      const isPending =
        status.includes(
          "PENDING"
        ) ||
        status.includes(
          "UNLIQUIDATED"
        ) ||
        status === "ACTIVE";

      if (
        isPending &&
        !status.includes(
          "CANCEL"
        ) &&
        !status.includes(
          "LIQUIDATED"
        )
      ) {
        const amt =
          Number(
            ca.amountApproved
          ) || 0;

        totalUnliquidated +=
          amt;

        const fund =
          getFundName(ca);

        unliquidatedByFund[
          fund
        ] =
          (unliquidatedByFund[
            fund
          ] || 0) + amt;

        unliquidatedAdvances.push(
          {
            id:
              ca.advanceId,
            date:
              ca.dateIssued
                ? new Date(
                    ca.dateIssued
                  )
                    .toISOString()
                    .split(
                      "T"
                    )[0]
                : "",
            requestor:
              ca.requestor,
            fund,
            amount:
              amt,
            due:
              ca.expectedReturnDate
                ? new Date(
                    ca.expectedReturnDate
                  )
                    .toISOString()
                    .split(
                      "T"
                    )[0]
                : "",
            status:
              ca.status,
          }
        );
      }
    }
  );

 // =========================================================================
// PACKAGE PAYMENT MAP
// =========================================================================
// Collection.studentId SHOULD contain Student.id (UUID).
//
// However, older records may contain Student.studentId instead,
// such as "20-C0524".
//
// This implementation supports BOTH:
//
// 1. Collection.studentId = Student.id
// 2. Collection.studentId = Student.studentId
// 3. Collection.studentName = unique Student.fullName
//
// Matching priority:
//    Student.id
//    -> Student.studentId
//    -> unique Student.fullName
//
// Each collection record is counted only once.
// =========================================================================

const paidByDbStudentId: Record<string, number> = {};
const paidByStudentNumber: Record<string, number> = {};
const paidByUniqueStudentName: Record<string, number> = {};

// =========================================================================
// BUILD STUDENT LOOKUP MAPS
// =========================================================================

const studentsByDbId = new Map<string, any>();
const studentsByStudentNumber = new Map<string, any>();
const studentNameCounts = new Map<string, number>();

students.forEach((student: any) => {
  if (!student?.id) {
    return;
  }

  const dbId = String(student.id)
    .trim()
    .toLowerCase();

  const studentNumber = String(
    student.studentId || ""
  )
    .trim()
    .toLowerCase();

  const studentName = String(
    student.fullName || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  studentsByDbId.set(
    dbId,
    student
  );

  if (studentNumber) {
    studentsByStudentNumber.set(
      studentNumber,
      student
    );
  }

  if (studentName) {
    studentNameCounts.set(
      studentName,
      (studentNameCounts.get(
        studentName
      ) || 0) + 1
    );
  }
});

// =========================================================================
// READ PACKAGE PAYMENTS
// =========================================================================

validCollections.forEach((c: any) => {
  const descLower = String(
    c.itemDescription || ""
  )
    .trim()
    .toLowerCase();

  // -----------------------------------------------------------------------
  // Determine whether this collection belongs to the departmental package.
  // -----------------------------------------------------------------------

  const isPackageItem =
    termPkg.items.some(
      (pi: any) =>
        String(pi.name || "")
          .trim()
          .toLowerCase() ===
        descLower
    );

  const isDepartmentalPackage =
    descLower ===
      "departmental fee package" ||
    descLower ===
      "departmental fee" ||
    descLower ===
      "departmental fee package (all items)";

  // Ignore unrelated collections such as:
  // Laboratory Fee
  // Penalty Fee
  // Replacement Fee
  // etc.
  if (
    !isPackageItem &&
    !isDepartmentalPackage
  ) {
    return;
  }

  const paid =
    Number(c.amountPaid) || 0;

  if (paid <= 0) {
    return;
  }

  // =======================================================================
  // 1. BEST MATCH: Prisma Student relation
  //
  // If c.student exists, c.student.id is definitely Student.id.
  // =======================================================================

  const relationDbId = String(
    c.student?.id || ""
  )
    .trim()
    .toLowerCase();

  if (
    relationDbId &&
    studentsByDbId.has(
      relationDbId
    )
  ) {
    paidByDbStudentId[
      relationDbId
    ] =
      (paidByDbStudentId[
        relationDbId
      ] || 0) + paid;

    return;
  }

  // =======================================================================
  // 2. CORRECT SCHEMA MATCH:
  // Collection.studentId = Student.id
  // =======================================================================

  const rawStudentReference =
    String(
      c.studentId || ""
    )
      .trim()
      .toLowerCase();

  if (
    rawStudentReference &&
    studentsByDbId.has(
      rawStudentReference
    )
  ) {
    paidByDbStudentId[
      rawStudentReference
    ] =
      (paidByDbStudentId[
        rawStudentReference
      ] || 0) + paid;

    return;
  }

  // =======================================================================
  // 3. LEGACY MATCH:
  // Collection.studentId = Student.studentId
  //
  // Example:
  // Collection.studentId = "20-C0524"
  // Student.studentId    = "20-C0524"
  // =======================================================================

  if (
    rawStudentReference &&
    studentsByStudentNumber.has(
      rawStudentReference
    )
  ) {
    paidByStudentNumber[
      rawStudentReference
    ] =
      (paidByStudentNumber[
        rawStudentReference
      ] || 0) + paid;

    return;
  }

  // =======================================================================
  // 4. LAST RESORT:
  // Match by unique student name only.
  //
  // This is intentionally NOT used when multiple students have
  // the same name.
  // =======================================================================

  const collectionStudentName =
    String(
      c.student?.fullName ||
        c.studentName ||
        ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  if (
    collectionStudentName &&
    studentNameCounts.get(
      collectionStudentName
    ) === 1
  ) {
    paidByUniqueStudentName[
      collectionStudentName
    ] =
      (paidByUniqueStudentName[
        collectionStudentName
      ] || 0) + paid;
  }
});

// =========================================================================
// STUDENT ITEM OBLIGATIONS
// =========================================================================

const studentItemObligations: Record<
  string,
  Set<string>
> = {};

const addStudentObligation = (
  studentKey: string,
  itemName: string
) => {
  if (
    !studentItemObligations[
      studentKey
    ]
  ) {
    studentItemObligations[
      studentKey
    ] = new Set();
  }

  if (
    !studentItemObligations[
      studentKey
    ].has(itemName)
  ) {
    studentItemObligations[
      studentKey
    ].add(itemName);

    return true;
  }

  return false;
};

// =========================================================================
// PACKAGE STUDENT POPULATION
// =========================================================================
// Combine:
// - all students in the organization
// - valid students appearing in the selected AY/term enrollment
//
// Deduplicate by Student.id.
// =========================================================================

const packageStudentMap =
  new Map<string, any>();

// Add all organization students.
students.forEach((student: any) => {
  if (student?.id) {
    packageStudentMap.set(
      String(student.id),
      student
    );
  }
});

// Add valid enrolled students for the selected AY/term.
enrollments
  .filter((enrollment: any) => {
    const status = String(
      enrollment.enrollmentStatus || ""
    )
      .trim()
      .toUpperCase();

    return (
      status !== "DROPPED" &&
      status !== "CANCELLED" &&
      status !== "INACTIVE"
    );
  })
  .forEach((enrollment: any) => {
    const student =
      enrollment?.student;

    if (student?.id) {
      packageStudentMap.set(
        String(student.id),
        student
      );
    }
  });

const packageStudents =
  Array.from(
    packageStudentMap.values()
  );

// =========================================================================
// PACKAGE RECEIVABLES
// =========================================================================

let unpaidOrPartialPackageCount =
  0;

let totalPackageReceivable =
  0;

packageStudents.forEach(
  (student: any) => {
    if (!student?.id) {
      return;
    }

    const dbId = String(
      student.id
    )
      .trim()
      .toLowerCase();

    const studentNumber =
      String(
        student.studentId || ""
      )
        .trim()
        .toLowerCase();

    const studentName =
      String(
        student.fullName || ""
      )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    // =====================================================================
    // DETERMINE PAYMENT TOTAL
    // =====================================================================

    let remitted = 0;

    // 1. Student.id
    if (
      dbId &&
      paidByDbStudentId[
        dbId
      ] !== undefined
    ) {
      remitted =
        paidByDbStudentId[
          dbId
        ];
    }

    // 2. Human-readable student number
    else if (
      studentNumber &&
      paidByStudentNumber[
        studentNumber
      ] !== undefined
    ) {
      remitted =
        paidByStudentNumber[
          studentNumber
        ];
    }

    // 3. Unique name
    else if (
      studentName &&
      paidByUniqueStudentName[
        studentName
      ] !== undefined
    ) {
      remitted =
        paidByUniqueStudentName[
          studentName
        ];
    }

    remitted =
      Math.round(
        remitted * 100
      ) / 100;

    // =====================================================================
    // CALCULATE REMAINING PACKAGE BALANCE
    // =====================================================================

    const remaining =
      Math.max(
        0,
        Math.round(
          (pkgTotal -
            remitted) *
            100
        ) / 100
      );

    // =====================================================================
    // ONLY UNPAID / PARTIAL STUDENTS APPEAR IN THE SUMMARY
    // =====================================================================

    if (remaining > 0) {
      unpaidOrPartialPackageCount +=
        1;

      totalPackageReceivable +=
        remaining;

      addStudentObligation(
        `ID:${dbId}`,
        "Departmental Fee"
      );
    }
  }
);

// =========================================================================
// FINAL PACKAGE RECEIVABLE TOTAL
// =========================================================================

totalPackageReceivable =
  Math.round(
    totalPackageReceivable *
      100
  ) / 100;

  // =========================================================================
  // OTHER COLLECTION OBLIGATIONS
  // =========================================================================

  const collectiblesMap: Record<
    string,
    {
      category: string;
      headcount: number;
      total: number;
    }
  > = {};

  if (
    unpaidOrPartialPackageCount >
    0
  ) {
    collectiblesMap[
      `Unsettled Departmental Fees (${term})`
    ] = {
      category:
        `Unsettled Departmental Fees (${term})`,
      headcount:
        unpaidOrPartialPackageCount,
      total:
        totalPackageReceivable,
    };
  }
const explicitCollectibleItemKeys = new Set<string>();

explicitCollectibles.forEach((ec: any) => {
  let rawCat = String(
    ec.category || "Unassigned"
  ).trim();

  let itemName = rawCat;

  if (rawCat.startsWith("Arrears: ")) {
    const core = rawCat.substring(9);

    const dashIdx = core.lastIndexOf(" - ");

    itemName =
      dashIdx !== -1
        ? core.substring(0, dashIdx).trim()
        : core;
  }

  const key = normalizeItemKey(itemName);

  if (key) {
    explicitCollectibleItemKeys.add(key);
  }
});
  /*
   * Aggregate non-package obligations by student + item.
   *
   * This fixes an important problem in the previous engine:
   * an old partial-payment row could retain balanceDue even
   * after a later payment fully settled the item.
   */
  const obligationGroups = new Map<
    string,
    {
      studentKey: string;
      itemName: string;
      assessedAmount: number;
      paidAmount: number;
      hasOutstandingMarker: boolean;
    }
  >();

  validCollections.forEach(
  (c: any) => {
    const desc =
      String(
        c.itemDescription ||
          ""
      ).trim();

    const descLower =
      desc.toLowerCase();

    const isPackageItem =
      termPkg.items.some(
        (pi: any) =>
          String(
            pi.name || ""
          )
            .trim()
            .toLowerCase() ===
          descLower
      );

    const isDepartmentalPackage =
      descLower ===
        "departmental fee package" ||
      descLower ===
        "departmental fee" ||
      descLower ===
        "departmental fee package (all items)";

    if (
      isPackageItem ||
      isDepartmentalPackage
    ) {
      return;
    }

    const category =
      String(
        c.category ||
          ""
      ).trim();

    const itemName =
      desc ||
      category ||
      "Other Due";
	  if (
    explicitCollectibleItemKeys.has(
      normalizeItemKey(itemName)
    )
  ) {
    return;
  }

      const studentKey =
        getStudentKey(
          c.studentId ||
            c.student?.id,
          c.student?.fullName ||
            c.studentName,
          `UNKNOWN-${c.id}`
        );

      const groupKey =
        `${studentKey}|${itemName
          .trim()
          .toLowerCase()}`;

      const assessed =
        Number(
          c.standardRate
        ) || 0;

      const paid =
        Number(
          c.amountPaid
        ) || 0;

      const balance =
        Number(
          c.balanceDue
        ) || 0;

      const paymentType =
        String(
          c.paymentType || ""
        );

      const orNumber =
        String(
          c.orNumber || ""
        );

      const outstandingMarker =
        balance > 0 ||
        paymentType
          .toLowerCase()
          .includes("unpaid") ||
        orNumber
          .toUpperCase()
          .startsWith("DUE-");

      const existing =
        obligationGroups.get(
          groupKey
        );

      if (existing) {
        existing.assessedAmount =
          Math.max(
            existing.assessedAmount,
            assessed
          );

        existing.paidAmount +=
          paid;

        existing.hasOutstandingMarker =
          existing.hasOutstandingMarker ||
          outstandingMarker;
      } else {
        obligationGroups.set(
          groupKey,
          {
            studentKey,
            itemName,
            assessedAmount:
              assessed,
            paidAmount:
              paid,
            hasOutstandingMarker:
              outstandingMarker,
          }
        );
      }
    }
  );

  obligationGroups.forEach(
    (group) => {
      const remaining =
        Math.max(
          0,
          Math.round(
            (group.assessedAmount -
              group.paidAmount) *
              100
          ) / 100
        );

      if (
        remaining <= 0 &&
        !group.hasOutstandingMarker
      ) {
        return;
      }

      const hasExistingStudentObligation =
        addStudentObligation(
          group.studentKey,
          group.itemName
        );

      if (
        !hasExistingStudentObligation
      ) {
        return;
      }

      if (
        !collectiblesMap[
          group.itemName
        ]
      ) {
        collectiblesMap[
          group.itemName
        ] = {
          category:
            group.itemName,
          headcount: 0,
          total: 0,
        };
      }

      collectiblesMap[
        group.itemName
      ].headcount +=
        1;

      collectiblesMap[
        group.itemName
      ].total +=
        remaining > 0
          ? remaining
          : group.assessedAmount;
    }
  );

  // =========================================================================
  // EXPLICIT COLLECTIBLES
  // =========================================================================

  explicitCollectibles.forEach(
    (ec: any) => {
      let rawCat =
        String(
          ec.category ||
            "Unassigned"
        ).trim();

      let itemName =
        rawCat;

      if (
        rawCat.startsWith(
          "Arrears: "
        )
      ) {
        const core =
          rawCat.substring(
            9
          );

        const dashIdx =
          core.lastIndexOf(
            " - "
          );

        itemName =
          dashIdx !== -1
            ? core
                .substring(
                  0,
                  dashIdx
                )
                .trim()
            : core;
      }

      const headcount =
        Number(
          ec.headcount
        ) || 1;

      const total =
        Number(
          ec.balanceDue
        ) ||
        0;

      if (
        !collectiblesMap[
          itemName
        ]
      ) {
        collectiblesMap[
          itemName
        ] = {
          category:
            itemName,
          headcount:
            0,
          total:
            0,
        };
      }

      collectiblesMap[
        itemName
      ].headcount +=
        headcount;

      collectiblesMap[
        itemName
      ].total +=
        total;
    }
  );

  const collectiblesList =
    Object.values(
      collectiblesMap
    );

  const totalCollectiblesSum =
    collectiblesList.reduce(
      (sum, c) =>
        sum + c.total,
      0
    );

  // =========================================================================
  // INITIAL FUNDS
  // =========================================================================

  let totalInitialAlloc =
    0;

  const initialAllocMap: Record<
    string,
    number
  > = {};

  initialFunds.forEach(
    (f: any) => {
      const fundName =
        String(
          f.fundName || ""
        ).trim();

      if (!fundName) {
        return;
      }

      const initAmt =
        Number(
          f.initialAllocation
        ) || 0;

      initialAllocMap[
        fundName
      ] =
        (initialAllocMap[
          fundName
        ] || 0) + initAmt;

      totalInitialAlloc +=
        initAmt;
    }
  );

  // =========================================================================
  // FUND TRANSFERS
  // =========================================================================

  const transferEffects: Record<
    string,
    number
  > = {};

  let carryOverInboundTotal =
    0;

  fundTransfers.forEach(
    (transfer: any) => {
      const amount =
        Number(
          transfer.amount
        ) || 0;

      if (amount <= 0) {
        return;
      }

      const source =
        String(
          transfer.sourceFund ||
            ""
        ).trim();

      const destination =
        String(
          transfer.destinationFund ||
            ""
        ).trim();

      /*
       * carryOverTermBalance() stores records in the destination
       * accounting period and encodes the old period into sourceFund.
       *
       * Treat that as an inbound opening balance for this period,
       * not as a same-period transfer that nets back to zero.
       */
      const isCarryOver =
        source
          .toLowerCase()
          .includes(
            "rollover"
          );

      if (isCarryOver) {
        if (destination) {
          transferEffects[
            destination
          ] =
            (transferEffects[
              destination
            ] || 0) + amount;
        }

        carryOverInboundTotal +=
          amount;
        return;
      }

      if (source) {
        transferEffects[
          source
        ] =
          (transferEffects[
            source
          ] || 0) - amount;
      }

      if (destination) {
        transferEffects[
          destination
        ] =
          (transferEffects[
            destination
          ] || 0) + amount;
      }
    }
  );

  const allFundNames =
    Array.from(
      new Set([
        ...Object.keys(
          collectionsByFund
        ),
        ...Object.keys(
          expensesByFund
        ),
        ...Object.keys(
          initialAllocMap
        ),
        ...Object.keys(
          unliquidatedByFund
        ),
        ...Object.keys(
          transferEffects
        ),
      ])
    ).sort((a, b) =>
      a.localeCompare(b)
    );

  const fundsList =
    allFundNames.map(
      (name) => {
        const collected =
          collectionsByFund[
            name
          ] || 0;

        const spent =
          expensesByFund[
            name
          ] || 0;

        const init =
          initialAllocMap[
            name
          ] || 0;

        const unliquidated =
          unliquidatedByFund[
            name
          ] || 0;

        const transferEffect =
          transferEffects[
            name
          ] || 0;

        const balance =
          init +
          collected -
          spent -
          unliquidated +
          transferEffect;

        return {
          name,
          collected,
          spent,
          unliquidated,
          balance,
        };
      }
    );

  /*
   * Same-period transfers net to zero globally.
   * Carry-over is different: it belongs to this period,
   * so it is an actual inbound balance.
   */
  const remainingBalance =
    totalInitialAlloc +
    grandCollectionTotal -
    grandExpenseTotal -
    totalUnliquidated +
    carryOverInboundTotal;

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    grandCollectionTotal,
    grandExpenseTotal,
    totalUnliquidated,
    totalCollectibles:
      totalCollectiblesSum,
    remainingBalance,
    unliquidatedAdvances,
    collectionHierarchy,
    expensesByFund,
    collectiblesList,
    fundsList,
    termPkg,
  };
}

// =========================================================================
// INITIAL FUNDS
// =========================================================================

export async function saveInitialFunds(
  department: string,
  ay: string,
  term: string,
  funds: {
    fundName: string;
    amount: number;
  }[]
) {
  await requireTabAccess(
    "tab-setup"
  );

  const officerName =
    await getActionUser();

  const orgId =
    await getOrgId(department);

  if (!Array.isArray(funds)) {
    throw new Error(
      "Invalid fund configuration."
    );
  }

  const combinedFunds =
    new Map<
      string,
      number
    >();

  for (const fund of funds) {
    const fundName =
      String(
        fund.fundName || ""
      ).trim();

    if (!fundName) {
      continue;
    }

    const amount =
      money(
        fund.amount,
        `Initial allocation for ${fundName}`
      );

    combinedFunds.set(
      fundName,
      (combinedFunds.get(
        fundName
      ) || 0) + amount
    );
  }

  const validFunds =
    Array.from(
      combinedFunds.entries()
    ).map(
      ([fundName, amount]) => ({
        fundName,
        amount,
      })
    );

  await prisma.$transaction(
    async (tx) => {
      await tx.fund.deleteMany({
        where: {
          organizationId:
            orgId,
          academicYear:
            ay,
          term,
        },
      });

      if (
        validFunds.length >
        0
      ) {
        await tx.fund.createMany(
          {
            data: validFunds.map(
              (f) => ({
                organizationId:
                  orgId,
                academicYear:
                  ay,
                term,
                fundName:
                  f.fundName,
                initialAllocation:
                  f.amount,
              })
            ),
          }
        );
      }
    }
  );

  await logSystemAction(
    orgId,
    officerName,
    "SETUP_FUNDS",
    `Configured ${validFunds.length} target funds for ${term} (${ay}).`
  );

  revalidatePath(
    `/department/${department}/setup`
  );
  revalidatePath(
    `/department/${department}`
  );
}

// =========================================================================
// COLLECTION SETUP
// =========================================================================

export async function saveCollectionSetupItem(
  department: string,
  payload: {
    category: string;
    name: string;
    amount: number;
    targetFund: string;
    isPackage: boolean;
    ay: string;
    term: string;
  }
) {
  await requireTabAccess(
    "tab-setup"
  );

  const orgId =
    await getOrgId(department);

  const cleanCategory =
    String(
      payload.category || ""
    ).trim();

  const cleanName =
    String(
      payload.name || ""
    ).trim();

  const targetFund =
    String(
      payload.targetFund || ""
    ).trim();

  const amount =
    money(
      payload.amount,
      "Collection setup amount"
    );

  if (!cleanName) {
    throw new Error(
      "Collection setup name is required."
    );
  }

  if (!targetFund) {
    throw new Error(
      "Target fund is required."
    );
  }

  const existing =
    await prisma.collectionSetup.findFirst(
      {
        where: {
          organizationId:
            orgId,
          academicYear:
            payload.ay,
          term:
            payload.term,
          name:
            cleanName,
        },
      }
    );

  if (existing) {
    await prisma.collectionSetup.update(
      {
        where: {
          id:
            existing.id,
        },
        data: {
          category:
            cleanCategory,
          amount,
          targetFund,
          isPackage:
            Boolean(
              payload.isPackage
            ),
        },
      }
    );
  } else {
    await prisma.collectionSetup.create(
      {
        data: {
          organizationId:
            orgId,
          academicYear:
            payload.ay,
          term:
            payload.term,
          category:
            cleanCategory,
          name:
            cleanName,
          amount,
          targetFund,
          isPackage:
            Boolean(
              payload.isPackage
            ),
        },
      }
    );
  }

  revalidatePath(
    `/department/${department}/setup/collections`
  );
  revalidatePath(
    `/department/${department}/collections`
  );
  revalidatePath(
    `/department/${department}/reports`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
  revalidatePath(
    `/department/${department}`
  );

  return {
    success: true,
    message:
      `Configured '${cleanName}' successfully.`,
  };
}

export async function deleteCollectionSetupItem(
  department: string,
  setupId: string
) {
  await requireTabAccess(
    "tab-setup"
  );

  const orgId =
    await getOrgId(department);

  const existing =
    await prisma.collectionSetup.findFirst(
      {
        where: {
          id:
            setupId,
          organizationId:
            orgId,
        },
      }
    );

  if (!existing) {
    throw new Error(
      "Collection setup item not found."
    );
  }

  await prisma.collectionSetup.deleteMany(
    {
      where: {
        id:
          existing.id,
        organizationId:
          orgId,
      },
    }
  );

  revalidatePath(
    `/department/${department}/setup/collections`
  );
  revalidatePath(
    `/department/${department}/collections`
  );
  revalidatePath(
    `/department/${department}/reports`
  );
  revalidatePath(
    `/department/${department}/clearance`
  );
  revalidatePath(
    `/department/${department}`
  );

  return {
    success: true,
    message:
      "Configuration item removed successfully.",
  };
}