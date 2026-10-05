"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';

// Helper: Format date for ID generation (yyyyMMdd-HHmmss)
function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// 1. Helper to get the Organization ID from the subdomain URL parameter
async function getOrgId(department: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: department },
  });
  if (!org) throw new Error("Department organization not found.");
  return org.id;
}

export async function createDepartment(formData: FormData) {
  const name = formData.get('name') as string;
  const subdomain = formData.get('subdomain') as string;
  const code = formData.get('code') as string;

  if (!name || !subdomain || !code) {
    throw new Error('All fields are required.');
  }

  try {
    await prisma.organization.create({
      data: {
        name,
        subdomain: subdomain.toLowerCase().trim(),
      },
    });
    revalidatePath('/');
    return { success: true, message: `Department '${name}' successfully registered!` };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Subdomain or code already exists.' };
  }
}

export async function assessStudentDue(department: string, payload: {
  studentId: string;
  studentName: string;
  category: string;
  itemDescription: string;
  amountDue: number;
  fundAllocation: string;
  date: string;
  ay: string;
  term: string;
}) {
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Department "${department}" not found.`);
  }

  await prisma.collectible.create({
    data: {
      organizationId: organization.id,
      academicYear: payload.ay,
      term: payload.term,
      category: payload.category,
      balanceDue: payload.amountDue, 
      status: 'Unpaid',
    },
  });

  revalidatePath(`/department/${department}/collectibles`);
  return { success: true, message: 'Student due successfully assessed.' };
}

export async function deletePenalty(department: string, penaltyId: string) {
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Department "${department}" not found.`);
  }

  await prisma.penalty.delete({
    where: { id: penaltyId, organizationId: organization.id },
  });

  revalidatePath(`/department/${department}/penalties`);
  return { success: true, message: "Penalty record deleted successfully." };
}

async function getActionUser(): Promise<string> {
  const session = await auth();
  const userWithRole = session?.user as typeof session?.user & { fullName?: string };
  return userWithRole?.fullName || userWithRole?.email || "System";
}

// 1. Server Action: Record Penalty
export async function recordPenalty(department: string, data: {
  date: string;
  studentId: string;
  studentName?: string;
  activity: string;
  hoursLate: number;
  ratePerHour: number;
  fineAmount: number;
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  const penaltyId = `PEN-${formatDate(new Date())}-${Math.floor(Math.random() * 1000)}`;

  await prisma.penalty.create({
    data: {
      organizationId: orgId,
      penaltyId,
      academicYear: data.ay,
      term: data.term,
      date: new Date(data.date),
      studentId: data.studentId,
      studentName: data.studentName || "Unknown",
      activity: data.activity,
      hoursLate: data.hoursLate,
      ratePerHour: data.ratePerHour,
      fineAmount: data.fineAmount,
      status: "Unsettled",
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "RECORD_PENALTY", `Assessed ₱${data.fineAmount} fine (${data.hoursLate} hrs) to ${data.studentName || "Unknown"} for ${data.activity}.`);

  revalidatePath(`/department/${department}/penalties`);
  revalidatePath(`/department/${department}`);
}

// 3. Server Action: Issue Cash Advance
export async function issueCashAdvance(department: string, data: {
  requestor: string;
  purpose: string;
  fundSource: string;
  amount: number;
  dateIssued: string;
  expectedReturnDate: string;
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  const advanceId = `CA-${formatDate(new Date())}-${Math.floor(Math.random() * 1000)}`;

  await prisma.cashAdvance.create({
    data: {
      organizationId: orgId,
      advanceId,
      academicYear: data.ay,
      term: data.term,
      requestor: data.requestor,
      purpose: data.purpose,
      fundSource: data.fundSource,
      amountApproved: data.amount,
      dateIssued: new Date(data.dateIssued),
      expectedReturnDate: new Date(data.expectedReturnDate),
      status: "Pending Liquidation",
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "ISSUE_ADVANCE", `Issued ₱${data.amount} cash advance [${advanceId}] to ${data.requestor} from ${data.fundSource}.`);

  revalidatePath(`/department/${department}/advances`);
  revalidatePath(`/department/${department}`);
}

// 4. Server Action: Record Collection (Payment)
export async function recordCollection(department: string, data: {
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
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  const balanceDue = Math.max(0, data.standardRate - data.amountPaid);

  await prisma.collection.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      orNumber: data.orNumber,
      studentId: data.studentId,
      studentName: data.studentName,
      category: data.category,
      itemDescription: data.itemDescription,
      paymentType: data.paymentType,
      standardRate: data.standardRate,
      amountPaid: data.amountPaid,
      balanceDue,
      fundAllocation: data.fundAllocation,
      status: "Valid",
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "RECORD_COLLECTION", `Collected ₱${data.amountPaid} from ${data.studentName} for ${data.itemDescription} [OR: ${data.orNumber}].`);

  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}`);
}

// 5. Server Action: Invalidate Online Remittance
export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  const officerName = await getActionUser();
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Department "${department}" not found.`);
  }

  const remittance = await prisma.onlineRemittance.findUnique({ where: { id: remittanceId, organizationId: organization.id }});

  await prisma.onlineRemittance.delete({
    where: { id: remittanceId, organizationId: organization.id },
  });

  if (remittance) {
    await logSystemAction(organization.id, officerName, "INVALIDATE_REMITTANCE", `Invalidated remittance [Ref: ${remittance.referenceNumber}] from ${remittance.studentName}.`);
  }

  revalidatePath(`/department/${department}/remittances`);
  return { success: true, message: 'Remittance submission marked as invalid and removed from queue.' };
}

// 6. Server Action: Save Bulk Collectibles
export async function saveBulkCollectibles(department: string, records: any[], ay: string, term: string) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  for (const r of records) {
    await prisma.collectible.create({
      data: {
        organizationId: orgId,
        academicYear: ay,
        term,
        category: r.category,
        headcount: parseInt(r.headcount) || 1,
        balanceDue: parseFloat(r.total) || 0,
        status: "Outstanding",
        encodedBy: officerName
      }
    });
  }

  await logSystemAction(orgId, officerName, "SAVE_COLLECTIBLES", `Assessed bulk collectibles across ${records.length} categories.`);

  revalidatePath(`/department/${department}/collectibles`);
}

// --- AUTHENTICATION ACTIONS ---

export async function requestOtp(
  department: string,
  email: string
) {
  const cleanDepartment = department.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  // --------------------------------------------------
  // FIND DEPARTMENT
  // --------------------------------------------------

  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanDepartment,
    },
  });

  if (!organization) {
    throw new Error(
      `Department '${cleanDepartment}' not found.`
    );
  }

  // --------------------------------------------------
  // FIND USER
  // --------------------------------------------------

  const user = await prisma.tenantUser.findFirst({
    where: {
      organizationId: organization.id,
      email: cleanEmail,
    },
  });

  if (!user) {
    throw new Error(
      "This account is not registered or does not belong to this department."
    );
  }

  if (user.status !== 'Active') {
    throw new Error(
      "This account is currently inactive."
    );
  }

  // --------------------------------------------------
  // CHECK LOCKOUT
  // --------------------------------------------------

  const cookieStore = await cookies();

  const lockoutCookie =
    cookieStore.get('fcu_lockout');

  if (lockoutCookie) {
    const lockoutTime =
      parseInt(lockoutCookie.value, 10);

    if (Date.now() < lockoutTime) {
      const remainingMinutes =
        Math.ceil(
          (lockoutTime - Date.now()) / 60000
        );

      throw new Error(
        `Too many failed attempts. Account temporarily locked. Try again in ${remainingMinutes} minute(s).`
      );
    }
  }

  // --------------------------------------------------
  // GENERATE OTP
  // --------------------------------------------------

  const otpCode =
    Math.floor(
      100000 + Math.random() * 900000
    ).toString();

  const hashedCode =
    crypto
      .createHash('sha256')
      .update(otpCode)
      .digest('hex');

  const expiresAt =
    Date.now() + 5 * 60 * 1000;

  // --------------------------------------------------
  // STORE OTP SESSION
  // --------------------------------------------------

  cookieStore.set(
    'fcu_otp_hash',
    `${hashedCode}:${expiresAt}`,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    }
  );

  cookieStore.set(
    'fcu_otp_email',
    cleanEmail,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    }
  );

  cookieStore.set(
    'fcu_otp_strikes',
    '0',
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    }
  );

  // --------------------------------------------------
  // GMAIL SMTP TRANSPORT
  // --------------------------------------------------

  const smtpUser =
    process.env.SMTP_USER;

  const smtpPass =
    process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.error(
      'SMTP_USER or SMTP_PASS is not configured.'
    );

    throw new Error(
      'Email service is not configured.'
    );
  }

  const transporter =
    nodemailer.createTransport({
      host:
        process.env.SMTP_HOST ||
        'smtp.gmail.com',

      port:
        Number(
          process.env.SMTP_PORT || 465
        ),

      secure: true,

      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

  // --------------------------------------------------
  // SEND OTP EMAIL
  // --------------------------------------------------

  try {

    await transporter.sendMail({
      from:
        `"CLEAR System" <${smtpUser}>`,

      to: cleanEmail,

      subject:
        `[CLEAR System] OTP CODE FOR COLLEGE OF ${cleanDepartment.toUpperCase()}`,

      text: `
CLEAR System

Filamer Christian University

You requested a verification code to sign in to the CLEAR System.

Your 6-digit One-Time PIN is:

${otpCode}

This code will expire in 5 minutes.

Do not share this code with anyone.

Centralized Liquidation of Expenses & Audit Records System
      `.trim(),

      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 30px;
          background-color: #f8f9fa;
          color: #333;
          border-radius: 10px;
          border: 1px solid #dee2e6;
        ">

          <h2 style="
            color: #0d6efd;
            margin-top: 0;
          ">
            Filamer Christian University, Inc.
          </h2>

          <h4 style="
            color: #495057;
            margin-bottom: 20px;
          ">
            CLEAR System Departmental Authorization
          </h4>

          <p>
            You requested a verification code to sign in
            to the CLEAR System.
          </p>

          <p>
            Your 6-digit one-time authorization PIN is:
          </p>

          <div style="
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #198754;
            background: #ffffff;
            padding: 18px 24px;
            display: inline-block;
            border: 1px solid #ced4da;
            border-radius: 8px;
            margin: 15px 0;
          ">
            ${otpCode}
          </div>

          <p style="
            font-size: 14px;
            color: #6c757d;
            margin-top: 18px;
          ">
            This code will expire in
            <strong>5 minutes</strong>.
          </p>

          <p style="
            font-size: 14px;
            color: #dc3545;
            font-weight: bold;
          ">
            Do not share this code with anyone.
          </p>

          <hr style="
            border: none;
            border-top: 1px solid #dee2e6;
            margin: 25px 0;
          " />

          <p style="
            font-size: 11px;
            color: #adb5bd;
            margin-bottom: 0;
          ">
            Centralized Liquidation of Expenses
            & Audit Records System
          </p>

        </div>
      `,
    });

  } catch (error) {

    console.error(
      'Gmail SMTP Error:',
      error
    );

    throw new Error(
      'Failed to dispatch verification email.'
    );
  }

  return {
    success: true,
    message:
      'Verification code sent successfully.',
  };
}

export async function verifyOtp(department: string, email: string, submittedOtp: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cookieStore = await cookies();

  const otpCookie = cookieStore.get('fcu_otp_hash');
  const emailCookie = cookieStore.get('fcu_otp_email');
  const strikesCookie = cookieStore.get('fcu_otp_strikes');

  if (!otpCookie || !emailCookie) {
    throw new Error("Verification session expired. Please request a new code.");
  }

  if (emailCookie.value !== cleanEmail) {
    throw new Error("Email mismatch. Please request a new code.");
  }

  let currentStrikes = strikesCookie ? parseInt(strikesCookie.value, 10) : 0;

  if (currentStrikes >= 5) {
    const lockoutUntil = Date.now() + 10 * 60 * 1000;
    cookieStore.set('fcu_lockout', lockoutUntil.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600
    });
    throw new Error("Maximum verification attempts exceeded. Account locked for 10 minutes.");
  }

  const [storedHash, expiryStr] = otpCookie.value.split(':');
  const expiresAt = parseInt(expiryStr, 10);

  if (Date.now() > expiresAt) {
    throw new Error("Verification code has expired. Please request a new one.");
  }

  const submittedHash = crypto.createHash('sha256').update(submittedOtp.trim()).digest('hex');
  if (submittedHash !== storedHash) {
    currentStrikes += 1;
    cookieStore.set('fcu_otp_strikes', currentStrikes.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 300
    });
    const remainingAttempts = 5 - currentStrikes;
    throw new Error(`Invalid verification code. ${remainingAttempts} attempt(s) remaining.`);
  }

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    throw new Error("Organization context lost.");
  }

  const user = await prisma.tenantUser.findFirst({
    where: { 
      organizationId: organization.id, 
      email: cleanEmail 
    }
  });

  if (!user) {
    throw new Error("User record not found.");
  }

  cookieStore.delete('fcu_otp_hash');
  cookieStore.delete('fcu_otp_email');
  cookieStore.delete('fcu_otp_strikes');

  cookieStore.set('fcu_session', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 86400 
  });

  return {
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      allowedTabs: JSON.parse(user.allowedTabs || '[]')
    }
  };
}

// 7. Server Action: Record Payment & Track Balances
export async function recordPayment(department: string, data: {
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
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  const paid = Number(data.amountPaid) || 0;
  const rate = Number(data.standardRate) || 0;
  const balanceDue = Math.max(0, rate - paid);
  const actualPaymentType = (rate > 0 && balanceDue === 0) ? "Full Payment" : data.paymentType;

  await prisma.collection.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      date: new Date(data.date),
      studentId: data.studentId,
      studentName: data.studentName,
      orNumber: data.orNumber,
      category: data.category,
      itemDescription: data.itemDescription,
      paymentType: actualPaymentType,
      standardRate: rate,
      amountPaid: paid,
      balanceDue,
      fundAllocation: data.fundAllocation,
      status: "Valid",
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "RECORD_PAYMENT", `Recorded payment of ₱${paid} from ${data.studentName} [OR: ${data.orNumber}].`);

  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}`);
}

// 8. Server Action: Record Audit & Settle Cash Advance
export async function recordAudit(department: string, data: {
  date: string;
  advanceId: string;
  requestor: string;
  fundSource: string;
  budgetRequested: number;
  totalExpense: number;
  items: { qty: number; orsi: string; desc: string; subTotal: number }[];
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  const auditId = `AUD-${formatDate(new Date())}`;
  const variance = data.budgetRequested - data.totalExpense;
  const cashReturn = variance > 0 ? variance : 0;
  const reimbursement = variance < 0 ? Math.abs(variance) : 0;
  const caRef = data.advanceId || "Direct Expense (No CA)";

  await prisma.audit.create({
    data: {
      organizationId: orgId,
      auditId,
      academicYear: data.ay,
      term: data.term,
      date: new Date(data.date),
      referenceCaId: caRef,
      requestor: data.requestor,
      fundSource: data.fundSource,
      budgetRequested: data.budgetRequested,
      totalExpense: data.totalExpense,
      varianceReturn: cashReturn,
      reimbursementDue: reimbursement,
      status: "Audited & Verified",
      encodedBy: officerName
    }
  });

  for (const item of data.items) {
    await prisma.expenseItem.create({
      data: {
        organizationId: orgId,
        auditId,
        orSiNumber: item.orsi || null,
        qty: item.qty,
        description: item.desc,
        subTotal: item.subTotal
      }
    });
  }

  if (data.advanceId) {
    await prisma.cashAdvance.updateMany({
      where: { organizationId: orgId, advanceId: data.advanceId },
      data: { status: "Liquidated" }
    });
  }

  await logSystemAction(orgId, officerName, "RECORD_LIQUIDATION", `Verified liquidation [${auditId}] for ${data.requestor} totaling ₱${data.totalExpense}.`);

  revalidatePath(`/department/${department}/liquidations`);
  revalidatePath(`/department/${department}`);
}

// 11. Server Action: Inter-Fund Transfer Realignment
export async function transferFunds(department: string, data: {
  fromFund: string;
  toFund: string;
  amount: number;
  reason: string;
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  await prisma.fundTransfer.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      sourceFund: data.fromFund,
      destinationFund: data.toFund,
      amount: data.amount,
      reason: data.reason,
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "TRANSFER_FUNDS", `Realigned ₱${data.amount} from ${data.fromFund} to ${data.toFund}.`);

  revalidatePath(`/department/${department}/realign`);
  revalidatePath(`/department/${department}`);
}

// 12. Server Action: Term Balance Carry-Over
export async function carryOverTermBalance(department: string, data: {
  sourceAY: string;
  sourceTerm: string;
  destAY: string;
  destTerm: string;
  amount: number;
  reason: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  await prisma.fundTransfer.create({
    data: {
      organizationId: orgId,
      academicYear: data.destAY,
      term: data.destTerm,
      sourceFund: `${data.sourceTerm} (${data.sourceAY}) Rollover`,
      destinationFund: "General Fund (Carried Over)",
      amount: data.amount,
      reason: data.reason,
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "CARRY_OVER", `Carried over ₱${data.amount} from ${data.sourceTerm} into ${data.destTerm} General Fund.`);

  revalidatePath(`/department/${department}/realign`);
  revalidatePath(`/department/${department}`);
}

// 13. Server Action: Submit Remittance Batch
export async function submitRemittanceBatch(department: string, data: {
  collectionIds: string[];
  depositSlipOr: string;
  remitDate: string;
  depositedBy: string;
  remarks: string;
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  await prisma.collection.updateMany({
    where: {
      organizationId: orgId,
      id: { in: data.collectionIds }
    },
    data: {
      status: `Remitted (Slip #${data.depositSlipOr})`
    }
  });

  await logSystemAction(orgId, officerName, "SUBMIT_REMITTANCE_BATCH", `Marked ${data.collectionIds.length} collections as remitted (Slip: ${data.depositSlipOr}).`);

  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}`);
}

// 14. Server Action: Verify Online Remittance & Issue OR
export async function verifyOnlineRemittance(department: string, data: {
  remittanceId: string;
  orNumber: string;
  studentId: string;
  studentName: string;
  particulars: string;
  amount: number;
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  await prisma.onlineRemittance.update({
    where: { id: data.remittanceId },
    data: { status: 'Verified', reviewedBy: officerName, orNumber: data.orNumber }
  });

  await prisma.collection.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      date: new Date(),
      studentId: data.studentId,
      studentName: data.studentName,
      orNumber: data.orNumber,
      category: 'Online Remittance',
      itemDescription: data.particulars,
      paymentType: 'Full Payment',
      standardRate: data.amount,
      amountPaid: data.amount,
      balanceDue: 0,
      fundAllocation: 'New Accounts (Current Operations)',
      status: 'Valid',
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "VERIFY_REMITTANCE", `Verified online remittance for ${data.studentName} and issued OR: ${data.orNumber}.`);

  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);
}

// 15. Server Action: Submit Online Payment Proof (Done by Student)
export async function submitOnlineRemittance(department: string, data: {
  studentId: string;
  studentName: string;
  email: string;
  paymentChannel: string;
  referenceNo: string;
  particulars: string;
  amount: number;
  proofBase64: string | null;
  ay: string;
  term: string;
}) {
  const orgId = await getOrgId(department);
  const submissionId = `SUB-${formatDate(new Date())}-${Math.floor(Math.random() * 1000)}`;

  await prisma.onlineRemittance.create({
    data: {
      organizationId: orgId,
      submissionId,
      academicYear: data.ay,
      term: data.term,
      studentId: data.studentId,
      studentName: data.studentName,
      paymentChannel: data.paymentChannel,
      referenceNumber: data.referenceNo,
      category: "Online Remittance", 
      itemDescription: `${data.particulars} (${data.email})`,
      paymentMode: "Online",
      amountPaid: data.amount,
      proofUrl: data.proofBase64,
      status: 'Pending Verification'
    }
  });

  // Logged as Public Submission since students don't log in
  await logSystemAction(orgId, "Public Submission", "SUBMIT_REMITTANCE", `Received ₱${data.amount} online payment proof from ${data.studentName} via ${data.paymentChannel}.`);

  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/clearance`);
}

// 16. Server Action: Add or Update Student Profile
export async function upsertStudent(department: string, data: {
  studentId: string;
  fullName: string;
  email: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  const cleanStudentId = data.studentId.trim();

  const existing = await prisma.student.findFirst({
    where: { organizationId: orgId, studentId: cleanStudentId }
  });

  if (existing) {
    await prisma.student.update({
      where: { id: existing.id },
      data: {
        fullName: data.fullName.trim(),
        email: data.email.trim() || null,
      },
    });
  } else {
    await prisma.student.create({
      data: {
        organizationId: orgId,
        studentId: cleanStudentId,
        fullName: data.fullName.trim(),
        email: data.email.trim() || null,
        yearLevel: "N/A", 
      },
    });
  }

  await logSystemAction(orgId, officerName, existing ? "UPDATE_STUDENT" : "ADD_STUDENT", `${existing ? 'Modified' : 'Registered'} profile for ${data.fullName} (${cleanStudentId}).`);

  revalidatePath(`/department/${department}/students`);
  revalidatePath(`/department/${department}/clearance`);
}

// 17. Server Action: Delete Student Record
export async function deleteStudent(department: string, studentId: string) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);
  
  const existing = await prisma.student.findFirst({
    where: { organizationId: orgId, studentId: studentId.trim() }
  });

  if (existing) {
    await prisma.student.delete({
      where: { id: existing.id }
    });
    
    await logSystemAction(orgId, officerName, "DELETE_STUDENT", `Permanently removed student record for ${existing.fullName} (${existing.studentId}).`);
  }

  revalidatePath(`/department/${department}/students`);
  revalidatePath(`/department/${department}/clearance`);
}

// 9. Server Action: Settle Penalty via Community Service
export async function settlePenaltyCommunityService(department: string, data: {
  penaltyId: string;
  hoursRendered: number;
  ay: string;
  term: string;
}) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  const targetPen = await prisma.penalty.findUnique({
    where: { penaltyId: data.penaltyId }
  });

  if (!targetPen) throw new Error("Penalty record not found.");

  const rate = targetPen.ratePerHour || 50.00;
  const deductionPesos = Math.round(data.hoursRendered * rate * 100) / 100;
  const remainingFine = Math.max(0, Math.round((targetPen.fineAmount - deductionPesos) * 100) / 100);

  const newStatus = remainingFine === 0 
    ? `Settled (Community Service - ${data.hoursRendered} hrs rendered)`
    : `Partially Served (${data.hoursRendered} hrs served, ₱${deductionPesos.toFixed(2)} deducted)`;

  await prisma.penalty.update({
    where: { id: targetPen.id },
    data: {
      fineAmount: remainingFine,
      status: newStatus
    }
  });

  await logSystemAction(orgId, officerName, "SETTLE_PENALTY_SERVICE", `Applied ${data.hoursRendered} hrs community service to penalty [${data.penaltyId}]. Status: ${newStatus}`);

  revalidatePath(`/department/${department}/penalties`);
  revalidatePath(`/department/${department}`);
}

// =========================================================================
// OPTIMIZED FINANCIAL ENGINE: ADAPTIVE TERM & A.Y. DATA FILTERING
// =========================================================================
export async function getDepartmentFinancials(organizationId: string, ay: string, term: string) {
  
  const [collections, audits, cashAdvances, explicitCollectibles, initialFunds, students] = await Promise.all([
    prisma.collection.findMany({ 
      where: { organizationId, academicYear: ay, term } 
    }),
    prisma.audit.findMany({ 
      where: { organizationId, academicYear: ay, term } 
    }),
    prisma.cashAdvance.findMany({ 
      where: { organizationId, academicYear: ay, term }, 
      orderBy: { dateIssued: 'desc' } 
    }),
    prisma.collectible.findMany({ 
      where: { organizationId, academicYear: ay, term } 
    }).catch(() => []),
    prisma.fund.findMany({ 
      where: { organizationId, academicYear: ay, term } 
    }),
    prisma.student.findMany({ 
      where: { organizationId } 
    }),
  ]);

  const validCollections = collections.filter(c => !c.paymentType?.toUpperCase().includes('VOID'));
  const validAudits = audits.filter(a => !a.status?.includes('VOID') && !a.status?.includes('CANCEL'));

  const termPackages: Record<string, { total: number; items: { name: string; rate: number; fund: string }[] }> = {
    "1st Sem": {
      total: 650.00,
      items: [
        { name: "JIECEP FCUSC Membership Fee (Student & Institutional)", rate: 250.00, fund: "JIECEP Membership Fund" },
        { name: "General Orientation/Acquaintance Party", rate: 200.00, fund: "General Orientation Fund" },
        { name: "COE FCUSR Activities", rate: 100.00, fund: "FCUSR Activities Fund" },
        { name: "Sports and Cultural Fund", rate: 100.00, fund: "Sports & Cultural Fund" }
      ]
    },
    "2nd Sem": {
      total: 900.00,
      items: [
        { name: "JIECEP FCUSC Fund", rate: 50.00, fund: "JIECEP FCUSC Fund" },
        { name: "JIECEP Week Activities (Local & Regional)", rate: 150.00, fund: "JIECEP Week Activities Fund" },
        { name: "ECE Grand Ball", rate: 650.00, fund: "ECE Grandball Fund" },
        { name: "Emergency/Calamity Fund", rate: 30.00, fund: "Emergency/Calamity Fund" },
        { name: "FCUSR Activities & Projects", rate: 20.00, fund: "FCUSR Activities Fund" }
      ]
    },
    "Summer": {
      total: 200.00,
      items: [
        { name: "Summer Departmental Operations", rate: 150.00, fund: "New Accounts (Current Operations)" },
        { name: "Special Activities Fund", rate: 50.00, fund: "JIECEP Activities Fund" }
      ]
    }
  };

  const termPkg = termPackages[term] || termPackages["1st Sem"];

  const getFundName = (row: any) => {
    const raw = String(row.fundAllocation || row.fundSource || row.fundName || row.fund || '').trim();
    return (raw === '' || raw === 'undefined' || raw === 'null') ? 'General Fund (Carried Over)' : raw;
  };

  let grandCollectionTotal = 0;
  const collectionHierarchy: Record<string, { count: number; total: number }> = {};
  const distinctStudents: Record<string, Set<string>> = {};
  const collectionsByFund: Record<string, number> = {};

  const addCollectionItem = (itemName: string, amt: number, studentKey: string, fund: string) => {
    grandCollectionTotal += amt;
    collectionsByFund[fund] = (collectionsByFund[fund] || 0) + amt;

    if (!collectionHierarchy[itemName]) {
      collectionHierarchy[itemName] = { count: 0, total: 0 };
      distinctStudents[itemName] = new Set();
    }
    collectionHierarchy[itemName].total += amt;
    if (amt > 0 && studentKey) {
      distinctStudents[itemName].add(studentKey);
    }
  };

  validCollections.forEach(c => {
    const itemDesc = c.itemDescription?.trim() || c.category?.trim() || 'General';
    const amt = Number(c.amountPaid) || 0;
    const studentKey = c.studentName ? c.studentName.trim().toLowerCase() : (c.studentId && c.studentId !== 'N/A' ? c.studentId.trim().toLowerCase() : c.orNumber);
    const fund = getFundName(c);

    const matchedPkgItem = termPkg.items.find(pi => pi.name.toLowerCase() === itemDesc.toLowerCase());

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey, matchedPkgItem.fund);
    } else if (itemDesc === 'Departmental Fee Package' || itemDesc === 'Departmental Fee') {
      const pkgTotalRate = termPkg.total;
      termPkg.items.forEach(pi => {
        const share = (pi.rate / pkgTotalRate) * amt;
        addCollectionItem(pi.name, share, studentKey, pi.fund);
      });
    } else {
      addCollectionItem(itemDesc, amt, studentKey, fund);
    }
  });

  Object.keys(collectionHierarchy).forEach(k => {
    collectionHierarchy[k].count = distinctStudents[k]?.size || 0;
  });

  let grandExpenseTotal = 0;
  const expensesByFund: Record<string, number> = {};

  validAudits.forEach(a => {
    const amt = Number(a.totalExpense) || 0;
    grandExpenseTotal += amt;
    const fund = getFundName(a);
    expensesByFund[fund] = (expensesByFund[fund] || 0) + amt;
  });

  let totalUnliquidated = 0;
  const unliquidatedAdvances: any[] = [];
  const unliquidatedByFund: Record<string, number> = {};

  cashAdvances.forEach(ca => {
    const status = String(ca.status || '').toUpperCase();
    if (status.includes('PENDING') && !status.includes('CANCEL')) {
      const amt = Number(ca.amountApproved) || 0;
      totalUnliquidated += amt;
      const fund = getFundName(ca);
      
      unliquidatedByFund[fund] = (unliquidatedByFund[fund] || 0) + amt;
      
      unliquidatedAdvances.push({
        id: ca.advanceId,
        date: ca.dateIssued ? new Date(ca.dateIssued).toISOString().split('T')[0] : '',
        requestor: ca.requestor,
        fund: fund,
        amount: amt,
        due: ca.expectedReturnDate ? new Date(ca.expectedReturnDate).toISOString().split('T')[0] : '',
        status: ca.status,
      });
    }
  });

  const pkgTotal = termPkg.total;
  const paidMap: Record<string, number> = {};

  validCollections.forEach(c => {
    if (c.category === 'Departmental Fee' || c.category === 'Departmental Fee - Package' || termPkg.items.some(pi => pi.name.toLowerCase() === (c.itemDescription || '').toLowerCase())) {
      const sId = c.studentId?.trim().toLowerCase() || '';
      const sName = c.studentName?.trim().toLowerCase() || '';
      const paid = Number(c.amountPaid) || 0;
      const key = sName || (sId && sId !== 'n/a' ? sId : '');
      if (key) {
        paidMap[key] = (paidMap[key] || 0) + paid;
      }
    }
  });

  let unpaidOrPartialPackageCount = 0;
  let totalPackageReceivable = 0;

  students.forEach(s => {
    const sId = s.studentId?.trim().toLowerCase() || '';
    const sName = s.fullName?.trim().toLowerCase() || '';
    const key = sName || sId;
    const remitted = paidMap[key] || 0;
    if (remitted < pkgTotal) {
      unpaidOrPartialPackageCount++;
      totalPackageReceivable += (pkgTotal - remitted);
    }
  });

  const collectiblesMap: Record<string, { category: string; headcount: number; total: number }> = {};

  if (unpaidOrPartialPackageCount > 0) {
    collectiblesMap[`Unsettled Departmental Fees (${term})`] = {
      category: `Unsettled Departmental Fees (${term})`,
      headcount: unpaidOrPartialPackageCount,
      total: totalPackageReceivable,
    };
  }

  validCollections.forEach(c => {
    const balDue = Number(c.balanceDue) || 0;
    const pType = c.paymentType || '';
    const orNum = c.orNumber || '';
    if ((balDue > 0 || pType.includes('Unpaid') || orNum.startsWith('DUE-')) && c.category !== 'Departmental Fee' && c.category !== 'Departmental Fee - Package') {
      const itemName = c.itemDescription || c.category || 'Other Due';
      if (!collectiblesMap[itemName]) {
        collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
      }
      collectiblesMap[itemName].headcount += 1;
      collectiblesMap[itemName].total += balDue > 0 ? balDue : Number(c.standardRate || 0);
    }
  });

  explicitCollectibles.forEach((ec: any) => {
    let rawCat = ec.category?.trim() || 'Unassigned';
    let itemName = rawCat;
    if (rawCat.startsWith('Arrears: ')) {
      const core = rawCat.substring(9);
      const dashIdx = core.lastIndexOf(' - ');
      itemName = dashIdx !== -1 ? core.substring(0, dashIdx).trim() : core;
    }
    const headcount = ec.headcount || 1;
    const total = Number(ec.balanceDue) || Number(ec.total) || 0;

    if (!collectiblesMap[itemName]) {
      collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
    }
    collectiblesMap[itemName].headcount += headcount;
    collectiblesMap[itemName].total += total;
  });

  const collectiblesList = Object.values(collectiblesMap);
  const totalCollectiblesSum = collectiblesList.reduce((sum, c) => sum + c.total, 0);

  let totalInitialAlloc = 0;
  const initialAllocMap: Record<string, number> = {};
  initialFunds.forEach(f => {
    if (f.fundName) { 
      const initAmt = Number(f.initialAllocation) || 0; 
      initialAllocMap[f.fundName] = initAmt;
      totalInitialAlloc += initAmt;
    }
  });

  const allFundNames = Array.from(new Set([
    ...Object.keys(collectionsByFund),
    ...Object.keys(expensesByFund),
    ...Object.keys(initialAllocMap),
    ...Object.keys(unliquidatedByFund)
  ])).sort((a, b) => a.localeCompare(b));

  const fundsList = allFundNames.map(name => {
    const collected = collectionsByFund[name] || 0;
    const spent = expensesByFund[name] || 0;
    const init = initialAllocMap[name] || 0;
    const unliquidated = unliquidatedByFund[name] || 0;
    
    const balance = init + collected - spent - unliquidated;
    
    return { name, collected, spent, unliquidated, balance };
  });

  const remainingBalance = totalInitialAlloc + grandCollectionTotal - grandExpenseTotal - totalUnliquidated;

  return {
    grandCollectionTotal,
    grandExpenseTotal,
    totalUnliquidated,
    totalCollectibles: totalCollectiblesSum,
    remainingBalance,
    unliquidatedAdvances,
    collectionHierarchy,
    expensesByFund,
    collectiblesList,
    fundsList,
    termPkg,
  };
}
