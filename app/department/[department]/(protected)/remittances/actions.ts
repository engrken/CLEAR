// /app/department/[department]/(protected)/remittances/actions.ts

"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { withFinancialTransaction } from '@/lib/financial-transaction';
import { receiptNumberConflictWhere } from "@/lib/receipt-number";
import { randomUUID, createHash } from 'node:crypto';
import { getPeriodLedger, toCents } from '../realign/ledger';
import { assertAcademicPeriod } from '@/lib/academic-period-guard';
import { applyPaymentToStudentCollectibles } from '../collectibles/due-link';
import { enqueuePaymentReceipt, enqueueAccountingNotice, scheduleDigitalReceiptDispatch } from '@/lib/digital-receipts';
import { ingressClientIp, normalizePublicPaymentChannel } from '@/lib/public-remittance-security';

// =========================================================================
// SECURITY CONFIGURATIONS FOR PUBLIC SUBMISSION
// =========================================================================
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window
const MAX_SUBMISSIONS_IN_WINDOW = 5; // Max 5 submissions per IP in 10 mins

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = Number(val);
  if (!Number.isFinite(parsed) || parsed <= 0 || Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001) throw new Error(`${fieldName} must be a positive amount with two decimal places or fewer.`);
  return Math.round(parsed * 100) / 100;
}

function generateReference(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12).toUpperCase()}`;
}

async function resolveStudentDbId(orgId: string, identifier: string | null) {
  if (!identifier) return null;

  let student = await prisma.student.findFirst({
    where: { id: identifier, organizationId: orgId }
  });

  if (!student) {
    student = await prisma.student.findFirst({
      where: { studentId: identifier, organizationId: orgId }
    });
  }

  return student ? student.id : null;
}

// =========================================================================
// ONLINE REMITTANCE (QUEUE VERIFICATION)
// =========================================================================

export async function verifyOnlineRemittance(
  department: string,
  data: {
    remittanceId: string; orNumber: string; studentId: string;
    studentName: string; particulars: string; amount: number;
    ay: string; term: string; fundAllocation: string;
  }
) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const officer = await requireTabAccess("tab-remittances", cleanDepartment);
  const officerName = String(officer.name || officer.fullName || officer.email || "System Administrator");
  const org = await prisma.organization.findUnique({ where: { subdomain: cleanDepartment }, select: { id: true } });
  if (!org) throw new Error("Department not found.");
  const orNumber = String(data.orNumber || "").trim().toUpperCase();
  const fundAllocation = String(data.fundAllocation || "").trim();
  if (!/^[A-Z0-9][A-Z0-9-]{2,50}$/.test(orNumber)) throw new Error("A valid OR number is required.");
  if (!fundAllocation || fundAllocation === "Multiple Funds (Package Split)") throw new Error("A valid fund is required.");

  await withFinancialTransaction(async (tx) => {
    const remit = await tx.onlineRemittance.findFirst({ where: {
      id: data.remittanceId, organizationId: org.id,
    } });
    if (!remit) throw new Error("Online submission was not found in this organization.");
    if (!["PENDING", "PENDING VERIFICATION"].includes(String(remit.status || "").toUpperCase())) {
      throw new Error("This submission was already reviewed. Refresh the queue.");
    }
    if (remit.academicYear !== data.ay || remit.term !== data.term) {
      throw new Error("Submission academic period does not match the page. Refresh before verifying.");
    }
    await assertAcademicPeriod(tx, org.id, remit.academicYear, remit.term);
    const ledger = await getPeriodLedger(tx, org.id, remit.academicYear, remit.term);
    if (ledger.activeRollover) throw new Error("This term has been carried forward and cannot accept verified payments.");
    // Reject arbitrary fund names before posting an official receipt. The
    // same ledger supplies the authorized fund options to the officer UI.
    if (!ledger.funds.some((fund) => fund.name.trim().toLowerCase() === fundAllocation.toLowerCase())) {
      throw new Error("Selected fund is not available in this academic term. Refresh the queue.");
    }
    const conflicted = await tx.collection.findFirst({ where: {
      organizationId: org.id, orNumber,
    }, select: { id: true } });
    if (conflicted) throw new Error(`Official receipt ${orNumber} already exists.`);

    const student = await tx.student.findFirst({ where: {
      organizationId: org.id,
      studentId: { equals: String(remit.studentId || "").trim(), mode: "insensitive" },
    } });
    if (!student) throw new Error("This payment cannot be linked to a registered student.");
    const amount = money(remit.amountPaid, "Submitted amount");
    const itemDescription = String(remit.itemDescription || "Online Payment").trim();
    if (/^Penalty Fine\s*(?:\[|:)/i.test(itemDescription) || /^penalt(?:y|ies)$/i.test(String(remit.category || "").trim())) {
      throw new Error("Penalty remittances need a linked penalty ID and an atomic balance adjustment. Use Penalty Logs → Pay in Cash; do not verify this as a generic fee.");
    }
    const isPackage = /departmental\s+fee.*package|departmental.*package/i.test(itemDescription);
    const packageItems = isPackage ? await tx.collectionSetup.findMany({ where: {
      organizationId: org.id, academicYear: remit.academicYear, term: remit.term,
      isPackage: true,
    }, orderBy: [{ category: "asc" }, { name: "asc" }] }) : [];
    const setup = !isPackage ? await tx.collectionSetup.findFirst({ where: {
      organizationId: org.id, academicYear: remit.academicYear,
      term: remit.term, name: itemDescription,
    } }) : null;
    const prior = await tx.collection.findMany({ where: {
      organizationId: org.id, academicYear: remit.academicYear,
      term: remit.term, studentId: student.id,
    } });
    const goodPrior = prior.filter(c => !String(c.status || "").toUpperCase().includes("VOID") &&
      !String(c.paymentType || "").toUpperCase().includes("VOID") &&
      !String(c.status || "").toUpperCase().includes("CANCEL"));
    const previouslyPaid = (name: string) => goodPrior.filter(c =>
      String(c.itemDescription || "").trim().toLowerCase() === name.toLowerCase()
    ).reduce((sum, c) => sum + toCents(c.amountPaid), 0);
    const amountCents = toCents(amount);
    const entries: { name: string; fund: string; rate: number; amount: number; balance: number; category: string }[] = [];

    if (isPackage && packageItems.length) {
      let legacyCredit = previouslyPaid("Departmental Fee (Full Package)") +
        previouslyPaid("Departmental Fee Package (All Items)");
      let leftToAllocate = amountCents;
      for (const item of packageItems) {
        const rate = toCents(item.amount);
        const previous = previouslyPaid(String(item.name));
        const availableBeforeLegacy = Math.max(0, rate - previous);
        const legacyApplied = Math.min(legacyCredit, availableBeforeLegacy);
        legacyCredit -= legacyApplied;
        const available = availableBeforeLegacy - legacyApplied;
        const piece = Math.min(leftToAllocate, available);
        if (piece > 0) {
          const fund = String(item.targetFund || "").trim();
          if (!fund) throw new Error(`Package fee ${item.name} is missing a target fund.`);
          entries.push({ name: String(item.name), fund, rate, amount: piece,
            balance: available - piece, category: String(item.category) });
          leftToAllocate -= piece;
        }
      }
      if (leftToAllocate !== 0 || entries.length === 0) {
        throw new Error("The verified remittance exceeds the student's remaining departmental package assessment.");
      }
    } else {
      const previous = previouslyPaid(itemDescription);
      const rate = setup ? toCents(setup.amount) : previous + amountCents;
      if (setup && previous + amountCents > rate) {
        throw new Error(`Payment exceeds the outstanding ${itemDescription} assessment. Review before verifying.`);
      }
      entries.push({ name: itemDescription, fund: String(setup?.targetFund || fundAllocation),
        rate, amount: amountCents, balance: Math.max(0, rate - previous - amountCents),
        category: String(remit.category || "Online Remittance") });
    }

    const existingOr = await tx.collection.findFirst({ where: receiptNumberConflictWhere(org.id, orNumber), select: { id: true } });
    if (existingOr) throw new Error(`Official receipt ${orNumber} or its package lines already exist.`);
    const updated = await tx.onlineRemittance.updateMany({ where: {
      id: remit.id, organizationId: org.id, status: remit.status,
    }, data: { status: "Verified", reviewedBy: officerName, orNumber } });
    if (updated.count !== 1) throw new Error("Submission was already processed by another officer.");
    for (const [index, entry] of entries.entries()) {
      await tx.collection.create({ data: {
        organizationId: org.id, academicYear: remit.academicYear, term: remit.term,
        date: new Date(), studentId: student.id, studentName: student.fullName,
        orNumber: index === 0 ? orNumber : `${orNumber}-P${String(index + 1).padStart(2, '0')}`,
        category: entry.category, itemDescription: entry.name,
        paymentType: entry.balance === 0 ? "Full Payment" : "Partial Payment",
        standardRate: entry.rate / 100, amountPaid: entry.amount / 100,
        balanceDue: entry.balance / 100,
        fundAllocation: entry.fund, status: "Valid", encodedBy: officerName,
      } });
    }
    if (!isPackage) {
      await applyPaymentToStudentCollectibles(tx, {
        organizationId: org.id, academicYear: remit.academicYear, term: remit.term,
        studentId: student.studentId, category: String(remit.category || ""), itemDescription, amountCents,
      });
    }
    await tx.systemLog.create({ data: {
      organizationId: org.id, user: officerName, action: "VERIFY_REMITTANCE",
      details: `Verified ${remit.submissionId}; OR ${orNumber}; ₱${amount.toFixed(2)}; ${student.studentId}.`,
    } });
    await enqueuePaymentReceipt(tx, { organizationId: org.id, orNumber, officerName, officerEmail: String(officer.email || ""), source: "APPROVED_REMITTANCE" });
  });

  for (const route of ["remittances", "collections", "clearance", "reports", "summary", "realign", "collectibles"]) {
    revalidatePath(`/department/${cleanDepartment}/${route}`);
  }
  revalidatePath(`/department/${cleanDepartment}`);
  scheduleDigitalReceiptDispatch(org.id, `payment:${orNumber}`);
  return { success: true, orNumber };
}

export async function invalidateOnlineRemittance(department: string, remittanceId: string) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const officer = await requireTabAccess("tab-remittances", cleanDepartment);
  const officerName = String(officer.name || officer.fullName || officer.email || "Officer");
  const org = await prisma.organization.findUnique({ where: { subdomain: cleanDepartment }, select: { id: true } });
  if (!org) throw new Error("Department not found.");
  await withFinancialTransaction(async (tx) => {
    const remit = await tx.onlineRemittance.findFirst({ where: { id: remittanceId, organizationId: org.id } });
    if (!remit || !["PENDING", "PENDING VERIFICATION"].includes(String(remit.status || "").toUpperCase())) {
      throw new Error("Only pending remittances can be rejected.");
    }
    const update = await tx.onlineRemittance.updateMany({
      where: { id: remit.id, organizationId: org.id, status: remit.status },
      data: { status: "Rejected", reviewedBy: officerName,
        reviewNotes: "Rejected by an authorized verification officer." },
    });
    if (update.count !== 1) throw new Error("This submission was already reviewed.");
    await tx.systemLog.create({ data: {
      organizationId: org.id, user: officerName, action: "INVALIDATE_REMITTANCE",
      details: `Rejected submitted payment proof ${remit.submissionId} / ${remit.referenceNumber}.`,
    } });
    // Rejection is a decision notice, NOT a payment receipt. No OR is invented.
    const matched = remit.studentId ? await tx.student.findFirst({ where: { organizationId: org.id,
      OR: [{ id: remit.studentId }, { studentId: remit.studentId }] }, select: { email: true, fullName: true } }) : null;
    await enqueueAccountingNotice(tx, {
      organizationId: org.id, eventKey: `remittance-rejected:${remit.id}`,
      documentType: "Remittance Rejection Notice", referenceNo: remit.submissionId,
      academicYear: remit.academicYear, term: remit.term,
      amount: Number(remit.amountPaid || 0), officerName, officerEmail: String(officer.email || ""),
      participantName: matched?.fullName || remit.studentName, participantEmail: matched?.email,
      details: [{label:"Decision",value:"Rejected — no official payment receipt issued"},
        {label:"Channel reference",value:remit.referenceNumber}],
    });
  });
  revalidatePath(`/department/${cleanDepartment}/remittances`);
  scheduleDigitalReceiptDispatch(org.id, `remittance-rejected:${remittanceId}`);
  return { success: true, message: "Remittance rejected." };
}

// =========================================================================
// PUBLIC SUBMISSION ENDPOINTS (HARDENED WITH RATE LIMITING & VALIDATION)
// =========================================================================

export async function submitOnlineRemittance(
  department: string,
  payload: FormData | {
    studentId: string;
    studentName: string;
    email: string;
    paymentChannel: string;
    referenceNo: string;
    particulars: string;
    amount: number;
    proofBase64: string | null;
    paymentMode?: string;
    ay: string;
    term: string;
  }
) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment }
  });
  if (!organization) throw new Error(`Organization "${cleanDepartment}" not found.`);
  if (String(organization.status || '').toLowerCase() !== 'active') {
    throw new Error('This department is not currently accepting payment proofs.');
  }
  const orgId = organization.id;

  // =========================================================
  // 1. IP-BASED RATE LIMITING (Using AuthThrottle Model)
  // =========================================================
  const headersList = await headers();
  const forwardedIp = ingressClientIp(headersList);
  const ipHash = createHash('sha256').update(`${orgId}|${forwardedIp}`).digest('hex').slice(0, 32);
  const throttleKey = `public_remit_${orgId}_${ipHash}`;

  // One atomic UPSERT counts each attempt. A separate read/update allowed
  // concurrent requests to bypass the limit. The period is fixed at the first
  // request until its ten-minute window expires.
  const now = new Date();
  const nowIso = now.toISOString();
  const windowStartIso = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  const throttleRows = await prisma.$queryRaw<{ failedCount: number }[]>`
    INSERT INTO "AuthThrottle" ("key", "failedCount", "lastSentAt", "updatedAt")
    VALUES (${throttleKey}, 1,
      (${nowIso}::timestamptz AT TIME ZONE 'UTC'),
      (${nowIso}::timestamptz AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "failedCount" = CASE
        WHEN "AuthThrottle"."lastSentAt" > (${windowStartIso}::timestamptz AT TIME ZONE 'UTC')
        THEN "AuthThrottle"."failedCount" + 1 ELSE 1 END,
      "lastSentAt" = CASE
        WHEN "AuthThrottle"."lastSentAt" > (${windowStartIso}::timestamptz AT TIME ZONE 'UTC')
        THEN "AuthThrottle"."lastSentAt" ELSE EXCLUDED."lastSentAt" END,
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "failedCount"
  `;
  if (Number(throttleRows[0]?.failedCount ?? 0) > MAX_SUBMISSIONS_IN_WINDOW) {
    throw new Error('Too many payment proof submissions from your network. Please wait 10 minutes before trying again.');
  }

  // =========================================================
  // 2. PARSE PAYLOAD & VALIDATE FILES (IF FORMDATA)
  // =========================================================
  let data;
  if (typeof (payload as FormData).get === 'function') {
    const formData = payload as FormData;
    data = {
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
      paymentMode: String(formData.get('paymentMode') || 'Online'),
    };

    const receiptFile = formData.get('receipt') as File | null;
    if (receiptFile) {
      if (receiptFile.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds the 5MB maximum limit. Please upload a smaller image.');
      }
      if (!ALLOWED_MIME_TYPES.includes(receiptFile.type.toLowerCase())) {
        throw new Error('Invalid file format. Only JPEG, PNG, and WebP receipt images are permitted.');
      }

      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      data.proofBase64 = `data:${receiptFile.type};base64,${buffer.toString('base64')}`;
    }
  } else {
    data = payload as any;
  }

  // =========================================================
  // 3. FIELD VALIDATIONS & SANITIZATION
  // =========================================================
  const cleanEmail = String(data.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Please provide a valid notification email address.");

  const amount = money(data.amount, "Online remittance amount");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  const targetStudentId = String(data.studentId || "").trim();
  const paymentChannel = normalizePublicPaymentChannel(data.paymentChannel);
  if (!paymentChannel) {
    throw new Error('Choose a valid payment channel: GCash, Maya, or Bank Transfer.');
  }
  const referenceNumber = String(data.referenceNo || "").trim();
  if (!paymentChannel || !referenceNumber || referenceNumber.length > 100) throw new Error("Payment channel and reference number are required.");
  if (!data.ay || !data.term) throw new Error("Academic year and term are required.");
  if (!data.proofBase64 || typeof data.proofBase64 !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(data.proofBase64)) {
    throw new Error("A valid payment proof image is required.");
  }
  const imageBytes = Buffer.from(data.proofBase64.slice(data.proofBase64.indexOf(',') + 1), 'base64');
  if (imageBytes.length === 0 || imageBytes.length > MAX_FILE_SIZE) throw new Error("Receipt image must not exceed 5MB.");
  const isPng = imageBytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
  const isWebp = imageBytes.subarray(0,4).toString() === 'RIFF' && imageBytes.subarray(8,12).toString() === 'WEBP';
  if (!isPng && !isJpeg && !isWebp) throw new Error("File is not a valid PNG, JPEG, or WebP image.");
  if (!targetStudentId) throw new Error("Student ID is required.");

  // =========================================================
  // 4. STUDENT EXISTENCE CHECK IN ORGANIZATION ROSTER
  // =========================================================
  const studentExists = await prisma.student.findFirst({
    where: {
      organizationId: orgId,
      studentId: { equals: targetStudentId, mode: 'insensitive' },
    },
  });

  if (!studentExists) {
    throw new Error(`Student ID "${targetStudentId}" is not registered under this department. Please verify your student ID.`);
  }

  const submissionId = generateReference("SUB");

  // The unique-reference check and insert must share the same serializable
  // transaction. Parallel requests for one channel/reference can no longer
  // both pass the check and write duplicate Pending submissions.
  await withFinancialTransaction(async (tx) => {
    await assertAcademicPeriod(tx, orgId, data.ay, data.term);
    const ledger = await getPeriodLedger(tx, orgId, data.ay, data.term);
    if (ledger.activeRollover) {
      throw new Error('The selected term has been closed; new proof submissions are unavailable.');
    }
    const duplicate = await tx.onlineRemittance.findFirst({
      where: {
        organizationId: orgId,
        paymentChannel: { equals: paymentChannel, mode: 'insensitive' },
        referenceNumber: { equals: referenceNumber, mode: 'insensitive' },
        status: { in: ["Pending", "Pending Verification", "Verified"] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("This payment reference has already been submitted for verification.");
    }

    await tx.onlineRemittance.create({
      data: {
        organizationId: orgId,
        submissionId,
        academicYear: data.ay,
        term: data.term,
        studentId: targetStudentId,
        studentName: studentExists.fullName,
        studentEmail: cleanEmail,
        paymentChannel,
        referenceNumber,
        category: "Online Remittance",
        itemDescription: String(data.particulars || "").trim().slice(0, 200),
        paymentMode: String(data.paymentMode || "Online").slice(0, 30),
        amountPaid: amount,
        proofUrl: data.proofBase64,
        status: "Pending Verification",
      },
    });

    await tx.systemLog.create({
      data: {
        organizationId: orgId,
        user: "Public Submission",
        action: "SUBMIT_REMITTANCE",
        details: `Received ₱${amount.toFixed(2)} online payment proof from registered student ${studentExists.studentId} via ${paymentChannel}.`,
      },
    });
  });

  revalidatePath(`/department/${cleanDepartment}/remittances`);
  revalidatePath(`/department/${cleanDepartment}/clearance`);

  return { success: true, message: "Payment proof submitted successfully." };
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
  return submitOnlineRemittance(department, {
    studentId: payload.studentId,
    studentName: payload.studentName,
    email: payload.email,
    paymentChannel: payload.channel,
    referenceNo: payload.referenceNo,
    particulars: payload.collectionType,
    amount: payload.amount,
    proofBase64: payload.proofBase64,
    paymentMode: payload.paymentMode,
    ay: payload.ay,
    term: payload.term,
  });
}