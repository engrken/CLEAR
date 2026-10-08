"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';

// =========================================================================
// AUTHORIZATION GUARD
// =========================================================================
export async function requireTabAccess(requiredTab: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("401 Unauthorized: Session expired or invalid.");
  }

  const customUser = session.user as any;
  const allowedTabs = (customUser.allowedTabs as string[]) || [];

  if (!allowedTabs.includes(requiredTab)) {
    throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
  }

  return customUser;
}

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function getOrgId(department: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: department },
  });
  if (!org) throw new Error("Department organization not found.");
  return org.id;
}

async function getActionUser(): Promise<string> {
  const session = await auth();
  const userWithRole = session?.user as { fullName?: string; email?: string } | undefined;
  return userWithRole?.fullName || userWithRole?.email || "System";
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
  await requireTabAccess('tab-collectibles');
  const orgId = await getOrgId(department);

  await prisma.collectible.create({
    data: {
      organizationId: orgId,
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
  await requireTabAccess('tab-void');
  const orgId = await getOrgId(department);

  // FIXED: Changed .delete() to .deleteMany() to safely combine id and organizationId
  await prisma.penalty.deleteMany({
    where: { id: penaltyId, organizationId: orgId },
  });

  revalidatePath(`/department/${department}/penalties`);
  return { success: true, message: "Penalty record deleted successfully." };
}

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
  await requireTabAccess('tab-penalties');
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
  await requireTabAccess('tab-advances');
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
  await requireTabAccess('tab-payment');
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
  await requireTabAccess('tab-payment');
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  const paid = Math.max(0, Number(data.amountPaid) || 0);
  const rate = Math.max(0, Number(data.standardRate) || 0);

  if (paid <= 0) throw new Error("Payment amount must be greater than zero.");
  if (rate <= 0) throw new Error("The payment has no valid standard rate.");
  if (paid > rate) throw new Error(`Payment amount ₱${paid.toFixed(2)} cannot exceed the assessed amount of ₱${rate.toFixed(2)}.`);

  const balanceDue = Math.max(0, Math.round((rate - paid) * 100) / 100);
  const actualPaymentType = balanceDue === 0 ? "Full Payment" : data.paymentType;
  const category = String(data.category || "").trim();
  const itemDescription = String(data.itemDescription || "").trim();

  await prisma.collection.create({
    data: {
      organizationId: orgId,
      academicYear: data.ay,
      term: data.term,
      date: new Date(data.date),
      studentId: data.studentId,
      studentName: data.studentName,
      orNumber: data.orNumber,
      category,
      itemDescription,
      paymentType: actualPaymentType,
      standardRate: rate,
      amountPaid: paid,
      balanceDue,
      fundAllocation: data.fundAllocation,
      status: "Valid",
      encodedBy: officerName
    }
  });

  await logSystemAction(orgId, officerName, "RECORD_PAYMENT", `Recorded payment of ₱${paid.toFixed(2)} from ${data.studentName} [OR: ${data.orNumber}] for ${itemDescription}.`);

  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);
}

export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  await requireTabAccess('tab-remittances');
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  // FIXED: Changed .findUnique() to .findFirst()
  const remittance = await prisma.onlineRemittance.findFirst({ 
    where: { id: remittanceId, organizationId: orgId } 
  });

  // FIXED: Changed .delete() to .deleteMany()
  await prisma.onlineRemittance.deleteMany({
    where: { id: remittanceId, organizationId: orgId },
  });

  if (remittance) {
    await logSystemAction(orgId, officerName, "INVALIDATE_REMITTANCE", `Invalidated remittance [Ref: ${remittance.referenceNumber}] from ${remittance.studentName}.`);
  }

  revalidatePath(`/department/${department}/remittances`);
  return { success: true, message: 'Remittance submission marked as invalid and removed from queue.' };
}

export async function saveBulkCollectibles(department: string, records: any[], ay: string, term: string) {
  await requireTabAccess('tab-collectibles');
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

export async function requestOtp(department: string, email: string) {
  const cleanDepartment = department.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();
  const orgId = await getOrgId(cleanDepartment);

  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: orgId, email: cleanEmail },
  });

  if (!user) throw new Error("This account is not registered or does not belong to this department.");
  if (user.status !== 'Active') throw new Error("This account is currently inactive.");

  const cookieStore = await cookies();
  const lockoutCookie = cookieStore.get('fcu_lockout');

  if (lockoutCookie) {
    const lockoutTime = parseInt(lockoutCookie.value, 10);
    if (Date.now() < lockoutTime) {
      const remainingMinutes = Math.ceil((lockoutTime - Date.now()) / 60000);
      throw new Error(`Too many failed attempts. Account temporarily locked. Try again in ${remainingMinutes} minute(s).`);
    }
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedCode = crypto.createHash('sha256').update(otpCode).digest('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000;

  cookieStore.set('fcu_otp_hash', `${hashedCode}:${expiresAt}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 300 });
  cookieStore.set('fcu_otp_email', cleanEmail, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 300 });
  cookieStore.set('fcu_otp_strikes', '0', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 300 });

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('Email service is not configured.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `"CLEAR System" <${smtpUser}>`,
      to: cleanEmail,
      subject: `[CLEAR System] OTP CODE FOR COLLEGE OF ${cleanDepartment.toUpperCase()}`,
      text: `Your 6-digit One-Time PIN is: ${otpCode}\n\nThis code will expire in 5 minutes.`,
    });
  } catch (error) {
    console.error('Gmail SMTP Error:', error);
    throw new Error('Failed to dispatch verification email.');
  }

  return { success: true, message: 'Verification code sent successfully.' };
}

export async function verifyOtp(department: string, email: string, submittedOtp: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cookieStore = await cookies();

  const otpCookie = cookieStore.get('fcu_otp_hash');
  const emailCookie = cookieStore.get('fcu_otp_email');
  const strikesCookie = cookieStore.get('fcu_otp_strikes');

  if (!otpCookie || !emailCookie) throw new Error("Verification session expired. Please request a new code.");
  if (emailCookie.value !== cleanEmail) throw new Error("Email mismatch. Please request a new code.");

  let currentStrikes = strikesCookie ? parseInt(strikesCookie.value, 10) : 0;

  if (currentStrikes >= 5) {
    const lockoutUntil = Date.now() + 10 * 60 * 1000;
    cookieStore.set('fcu_lockout', lockoutUntil.toString(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
    throw new Error("Maximum verification attempts exceeded. Account locked for 10 minutes.");
  }

  const [storedHash, expiryStr] = otpCookie.value.split(':');
  const expiresAt = parseInt(expiryStr, 10);

  if (Date.now() > expiresAt) throw new Error("Verification code has expired. Please request a new one.");

  const submittedHash = crypto.createHash('sha256').update(submittedOtp.trim()).digest('hex');
  if (submittedHash !== storedHash) {
    currentStrikes += 1;
    cookieStore.set('fcu_otp_strikes', currentStrikes.toString(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300 });
    const remainingAttempts = 5 - currentStrikes;
    throw new Error(`Invalid verification code. ${remainingAttempts} attempt(s) remaining.`);
  }

  const orgId = await getOrgId(department);

  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: orgId, email: cleanEmail }
  });

  if (!user) throw new Error("User record not found.");

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
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, allowedTabs: JSON.parse(user.allowedTabs || '[]') }
  };
}

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
  await requireTabAccess('tab-audit');
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

export async function transferFunds(department: string, data: {
  fromFund: string;
  toFund: string;
  amount: number;
  reason: string;
  ay: string;
  term: string;
}) {
  await requireTabAccess('tab-transfer');
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

export async function carryOverTermBalance(department: string, data: {
  sourceAY: string;
  sourceTerm: string;
  destAY: string;
  destTerm: string;
  amount: number;
  reason: string;
}) {
  await requireTabAccess('tab-transfer');
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

export async function submitRemittanceBatch(department: string, data: {
  collectionIds: string[];
  depositSlipOr: string;
  remitDate: string;
  depositedBy: string;
  remarks: string;
  ay: string;
  term: string;
}) {
  await requireTabAccess('tab-remittances');
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
  await requireTabAccess('tab-remittances');
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  await prisma.onlineRemittance.update({
    where: { id: data.remittanceId, organizationId: orgId },
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

  await logSystemAction(orgId, "Public Submission", "SUBMIT_REMITTANCE", `Received ₱${data.amount} online payment proof from ${data.studentName} via ${data.paymentChannel}.`);
  revalidatePath(`/department/${department}/remittances`);
  revalidatePath(`/department/${department}/clearance`);
}

export async function submitOnlineRemittanceDirect(department: string, payload: {
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
}) {
  return submitOnlineRemittance(department, {
    studentId: payload.studentId,
    studentName: payload.studentName,
    email: payload.email,
    paymentChannel: payload.channel,
    referenceNo: payload.referenceNo,
    particulars: payload.collectionType,
    amount: payload.amount,
    proofBase64: payload.proofBase64,
    ay: payload.ay,
    term: payload.term
  });
}

export async function upsertStudent(department: string, data: {
  studentId: string;
  fullName: string;
  email: string;
}) {
  await requireTabAccess('tab-students');
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

export async function deleteStudent(department: string, studentId: string) {
  await requireTabAccess('tab-students');
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

export async function settlePenaltyCommunityService(department: string, data: {
  penaltyId: string;
  hoursRendered: number;
  ay: string;
  term: string;
}) {
  await requireTabAccess('tab-penalties');
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  // FIXED: Changed .findUnique() to .findFirst()
  const targetPen = await prisma.penalty.findFirst({
    where: { penaltyId: data.penaltyId, organizationId: orgId }
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

export async function updateMyEmail(department: string, newEmail: string) {
  const session = await auth();
  const sessionUser = session?.user as { email?: string } | undefined;

  if (!sessionUser?.email) {
    throw new Error("Unauthorized: No active session found.");
  }

  const orgId = await getOrgId(department);
  const cleanNewEmail = newEmail.trim().toLowerCase();

  if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
    throw new Error("Please provide a valid email address.");
  }

  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: orgId, email: sessionUser.email }
  });

  if (!user) {
    throw new Error("User record not found in this department.");
  }

  const existing = await prisma.tenantUser.findFirst({
    where: { organizationId: orgId, email: cleanNewEmail }
  });

  if (existing && existing.id !== user.id) {
    throw new Error("This email is already registered by another account.");
  }

  await prisma.tenantUser.update({
    where: { id: user.id },
    data: { email: cleanNewEmail }
  });

  revalidatePath(`/department/${department}`);
  return { success: true, message: "Email updated successfully! Please sign out and sign back in to apply changes fully." };
}

// =========================================================================
// OPTIMIZED FINANCIAL ENGINE: ADAPTIVE TERM & A.Y. DATA FILTERING
// =========================================================================
export async function getDepartmentFinancials(organizationId: string, ay: string, term: string) {
  const [collections, audits, cashAdvances, explicitCollectibles, initialFunds, students, collectionSetups] = await Promise.all([
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
    prisma.collectionSetup.findMany({ 
      where: { organizationId, academicYear: ay, term } 
    }).catch(() => []) 
  ]);

  const validCollections = collections.filter((c: any) => !String(c.paymentType || '').toUpperCase().includes('VOID'));
  const validAudits = Array.isArray(audits) ? audits.filter((a: any) => !String(a.status || '').includes('VOID') && !String(a.status || '').includes('CANCEL')) : [];

  const legacyTermPackages: Record<string, { total: number; items: { name: string; rate: number; fund: string }[] }> = {
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

  let pkgTotal = 0;
  const currentPkgItems: { name: string; rate: number; fund: string }[] = [];
  const packageItems = (collectionSetups || []).filter((c: any) => c.isPackage !== false);

  if (packageItems.length > 0) {
    packageItems.forEach((s: any) => {
      pkgTotal += s.amount;
      currentPkgItems.push({ name: s.name, rate: s.amount, fund: s.targetFund });
    });
  } else {
    const fallbackPkg = legacyTermPackages[term] || legacyTermPackages["1st Sem"];
    pkgTotal = fallbackPkg.total;
    currentPkgItems.push(...fallbackPkg.items);
  }

  const termPkg = { total: pkgTotal, items: currentPkgItems };

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

  validCollections.forEach((c: any) => {
    const itemDesc = String(c.itemDescription || c.category || 'General').trim();
    const amt = Number(c.amountPaid) || 0;
    const studentKey = c.studentName ? String(c.studentName).trim().toLowerCase() : (c.studentId && c.studentId !== 'N/A' ? String(c.studentId).trim().toLowerCase() : String(c.orNumber));
    const fund = getFundName(c);

    const matchedPkgItem = termPkg.items.find((pi: any) => pi.name.toLowerCase() === itemDesc.toLowerCase());

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey, matchedPkgItem.fund);
    } else if (itemDesc === 'Departmental Fee Package' || itemDesc === 'Departmental Fee' || itemDesc === 'Departmental Fee Package (All Items)') {
      const pkgToUse = termPkg.items.length > 0 ? termPkg : (legacyTermPackages[term] || legacyTermPackages["1st Sem"]);
      const pkgTotalRate = pkgToUse.total;
      if (pkgTotalRate > 0) {
        pkgToUse.items.forEach((pi: any) => {
          const share = (pi.rate / pkgTotalRate) * amt;
          addCollectionItem(pi.name, share, studentKey, pi.fund);
        });
      } else {
        addCollectionItem(itemDesc, amt, studentKey, fund);
      }
    } else {
      addCollectionItem(itemDesc, amt, studentKey, fund);
    }
  });

  Object.keys(collectionHierarchy).forEach(k => {
    collectionHierarchy[k].count = distinctStudents[k]?.size || 0;
  });

  let grandExpenseTotal = 0;
  const expensesByFund: Record<string, number> = {};

  validAudits.forEach((a: any) => {
    const amt = Number(a.totalExpense) || 0;
    grandExpenseTotal += amt;
    const fund = getFundName(a);
    expensesByFund[fund] = (expensesByFund[fund] || 0) + amt;
  });

  let totalUnliquidated = 0;
  const unliquidatedAdvances: any[] = [];
  const unliquidatedByFund: Record<string, number> = {};

  cashAdvances.forEach((ca: any) => {
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

  const paidMap: Record<string, number> = {};
  const studentItemObligations: Record<string, Set<string>> = {}; 

  const addStudentObligation = (studentKey: string, itemName: string) => {
    if (!studentItemObligations[studentKey]) {
      studentItemObligations[studentKey] = new Set();
    }
    if (!studentItemObligations[studentKey].has(itemName)) {
      studentItemObligations[studentKey].add(itemName);
      return true; 
    }
    return false; 
  };

  validCollections.forEach((c: any) => {
    const catLower = String(c.category || '').toLowerCase();
    const descLower = String(c.itemDescription || '').toLowerCase();
    
    if (
      catLower.includes('fee') || 
      catLower.includes('package') || 
      termPkg.items.some((pi: any) => pi.name.toLowerCase() === descLower)
    ) {
      const sId = String(c.studentId || '').trim().toLowerCase();
      const sName = String(c.studentName || '').trim().toLowerCase();
      const paid = Number(c.amountPaid) || 0;
      const key = sName || (sId && sId !== 'n/a' ? sId : '');
      if (key) {
        paidMap[key] = (paidMap[key] || 0) + paid;
      }
    }
  });

  let unpaidOrPartialPackageCount = 0;
  let totalPackageReceivable = 0;

  students.forEach((s: any) => {
    const sId = String(s.studentId || '').trim().toLowerCase();
    const sName = String(s.fullName || '').trim().toLowerCase();
    const key = sName || sId;
    const remitted = paidMap[key] || 0;
    if (remitted < pkgTotal) {
      unpaidOrPartialPackageCount++;
      totalPackageReceivable += (pkgTotal - remitted);
      if (key) addStudentObligation(key, 'Departmental Fee');
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

  validCollections.forEach((c: any) => {
    const balDue = Number(c.balanceDue) || 0;
    const pType = String(c.paymentType || '');
    const orNum = String(c.orNumber || '');
    const sId = String(c.studentId || '').trim().toLowerCase();
    const sName = String(c.studentName || '').trim().toLowerCase();
    const studentKey = sName || sId || `UNKNOWN-${c.id}`;

    if ((balDue > 0 || pType.includes('Unpaid') || orNum.startsWith('DUE-')) && c.category !== 'Departmental Fee' && c.category !== 'Departmental Fee - Package') {
      const itemName = String(c.itemDescription || c.category || 'Other Due');
      
      if (addStudentObligation(studentKey, itemName)) {
        if (!collectiblesMap[itemName]) {
          collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
        }
        collectiblesMap[itemName].headcount += 1;
        collectiblesMap[itemName].total += balDue > 0 ? balDue : Number(c.standardRate || 0);
      }
    }
  });

  (explicitCollectibles as any[]).forEach((ec: any) => {
    let rawCat = String(ec.category || 'Unassigned').trim();
    let itemName = rawCat;
    if (rawCat.startsWith('Arrears: ')) {
      const core = rawCat.substring(9);
      const dashIdx = core.lastIndexOf(' - ');
      itemName = dashIdx !== -1 ? core.substring(0, dashIdx).trim() : core;
    }
    const headcount = Number(ec.headcount) || 1;
    const total = Number(ec.balanceDue) || Number(ec.total) || 0;

    const sId = String(ec.studentId || '').trim().toLowerCase();
    const sName = String(ec.studentName || ec.fullName || '').trim().toLowerCase();

    if (sId || sName) {
      const studentKey = sName || sId;
      if (addStudentObligation(studentKey, itemName)) {
        if (!collectiblesMap[itemName]) {
          collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
        }
        collectiblesMap[itemName].headcount += headcount;
        collectiblesMap[itemName].total += total;
      }
    } else {
      if (!collectiblesMap[itemName]) {
        collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
        collectiblesMap[itemName].headcount += headcount;
        collectiblesMap[itemName].total += total;
      }
    }
  });

  const collectiblesList = Object.values(collectiblesMap);
  const totalCollectiblesSum = collectiblesList.reduce((sum, c) => sum + c.total, 0);

  let totalInitialAlloc = 0;
  const initialAllocMap: Record<string, number> = {};
  initialFunds.forEach((f: any) => {
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

export async function saveInitialFunds(
  department: string, 
  ay: string, 
  term: string, 
  funds: { fundName: string, amount: number }[]
) {
  const officerName = await getActionUser();
  const orgId = await getOrgId(department);

  const validFunds = funds.filter(f => f.fundName.trim() !== "");

  await prisma.$transaction(async (tx) => {
    await tx.fund.deleteMany({
      where: { organizationId: orgId, academicYear: ay, term }
    });

    if (validFunds.length > 0) {
      await tx.fund.createMany({
        data: validFunds.map(f => ({
          organizationId: orgId,
          academicYear: ay,
          term: term,
          fundName: f.fundName.trim(),
          initialAllocation: f.amount,
          encodedBy: officerName
        }))
      });
    }
  });

  await logSystemAction(
    orgId, 
    officerName, 
    "SETUP_FUNDS", 
    `Configured ${validFunds.length} target funds for ${term} (${ay}).`
  );

  revalidatePath(`/department/${department}/setup`);
  revalidatePath(`/department/${department}`);
}

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
  await requireTabAccess("tab-setup");
  const orgId = await getOrgId(department);
  const cleanCategory = payload.category.trim();
  const cleanName = payload.name.trim();

  const existing = await prisma.collectionSetup.findFirst({
    where: {
      organizationId: orgId,
      academicYear: payload.ay,
      term: payload.term,
      name: cleanName,
    },
  });

  if (existing) {
    await prisma.collectionSetup.update({
      where: { id: existing.id },
      data: {
        category: cleanCategory,
        amount: Number(payload.amount) || 0,
        targetFund: payload.targetFund,
        isPackage: Boolean(payload.isPackage),
      },
    });
  } else {
    await prisma.collectionSetup.create({
      data: {
        organizationId: orgId,
        academicYear: payload.ay,
        term: payload.term,
        category: cleanCategory,
        name: cleanName,
        amount: Number(payload.amount) || 0,
        targetFund: payload.targetFund,
        isPackage: Boolean(payload.isPackage),
      },
    });
  }

  revalidatePath(`/department/${department}/setup/collections`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);

  return { success: true, message: `Configured '${cleanName}' successfully.` };
}

export async function deleteCollectionSetupItem(department: string, setupId: string) {
  await requireTabAccess("tab-setup");
  const orgId = await getOrgId(department);

  // FIXED: Changed .delete() to .deleteMany()
  await prisma.collectionSetup.deleteMany({
    where: {
      id: setupId,
      organizationId: orgId,
    },
  });

  revalidatePath(`/department/${department}/setup/collections`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/reports`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);

  return { success: true, message: "Configuration item removed successfully." };
}