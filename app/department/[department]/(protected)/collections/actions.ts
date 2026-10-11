"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';
import nodemailer from 'nodemailer';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return parsed;
}

function parseDate(val: any, fieldName: string): Date {
  const date = new Date(val);
  if (isNaN(date.getTime())) throw new Error(`Invalid date format for ${fieldName}`);
  return date;
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

  if (!student) {
    throw new Error(`Student identifier "${identifier}" is not registered in your roster.`);
  }

  return student.id;
}

async function sendEmailReceipt(
  orgName: string, 
  studentEmail: string, 
  data: {
    orNumber: string;
    date: Date;
    studentName: string;
    itemDescription: string;
    amountPaid: number;
    balanceDue: number;
    paymentType: string;
  }
) {
  if (!studentEmail) return;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const formattedAmount = `₱${data.amountPaid.toFixed(2)}`;
    const formattedBalance = `₱${data.balanceDue.toFixed(2)}`;
    const formattedDate = data.date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">${orgName}</h2>
          <p style="margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;">Filamer Christian University</p>
        </div>
        
        <div style="padding: 30px 20px; background-color: #ffffff; color: #334155;">
          <div style="text-align: center; margin-bottom: 25px;">
            <h3 style="margin: 0; color: #0284c7; letter-spacing: 1px;">OFFICIAL RECEIPT</h3>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #64748b;">OR No. <strong>${data.orNumber}</strong></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Date:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${formattedDate}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b;">Received from:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.studentName}</td>
            </tr>
            <tr>
              <td style="padding: 15px 0 8px 0; color: #64748b;">Payment For:</td>
              <td style="padding: 15px 0 8px 0; text-align: right; font-weight: bold;">${data.itemDescription}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Payment Type:</td>
              <td style="padding: 8px 0; text-align: right;">${data.paymentType}</td>
            </tr>
            <tr style="border-top: 2px dashed #cbd5e1; border-bottom: 2px dashed #cbd5e1;">
              <td style="padding: 12px 0; font-weight: bold; color: #0f172a;">Amount Paid:</td>
              <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #16a34a; font-size: 16px;">${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0 8px 0; color: #64748b;">Remaining Balance:</td>
              <td style="padding: 12px 0 8px 0; text-align: right; font-weight: bold; color: ${data.balanceDue > 0 ? '#dc2626' : '#16a34a'};">${formattedBalance}</td>
            </tr>
          </table>

          <p style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 30px;">
            This is a system-generated digital receipt from the CLEAR System. No signature is required.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${orgName} Finance" <${process.env.GMAIL_USER}>`,
      to: studentEmail,
      subject: `Official Receipt [${data.orNumber}] - ${orgName}`,
      html: htmlContent,
    });
    
    console.log(`Receipt successfully sent to ${studentEmail}`);
  } catch (error) {
    console.error("Failed to send digital receipt:", error);
  }
}

async function getPreviouslyPaid(
  orgId: string, 
  studentId: string, 
  studentName: string, 
  ay: string, 
  term: string, 
  itemDescription: string
): Promise<number> {
  const previousPayments = await prisma.collection.findMany({
    where: {
      organizationId: orgId,
      academicYear: ay,
      term: term,
      studentId: studentId,
      itemDescription: itemDescription,
      paymentType: { not: { contains: "Voided" } }
    },
    select: { amountPaid: true }
  });
  
  return previousPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
}

// =========================================================================
// PAYMENT ACTIONS
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
    penaltyId?: string; // <-- ADDED SUPPORT FOR PENALTY SETTLEMENT
  }
) {
  // 1. Verify Permission via Shared Guard
  const customUser = await requireTabAccess("tab-payment");
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${department}" not found.`);
  }
  const orgId = organization.id;

  // 3. Validate Inputs & Fetch the Correct UUID
  const rawStudentInput = String(data.studentId || "").trim() || null;
  const studentDbId = await resolveStudentDbId(orgId, rawStudentInput);

  if (!studentDbId) throw new Error("A valid student record is required for payment.");

  const paid = money(data.amountPaid, "Payment amount");
  const rate = money(data.standardRate, "Standard rate");

  if (paid <= 0) throw new Error("Payment amount must be greater than zero.");
  if (rate <= 0) throw new Error("The payment has no valid standard rate.");

  const date = parseDate(data.date, "payment date");
  const category = String(data.category || "").trim();
  const itemDescription = String(data.itemDescription || "").trim();
  const studentName = String(data.studentName || "").trim();

  if (!itemDescription) throw new Error("Item description is required.");

  // 4. Calculate Installments and Balances
  const alreadyPaid = await getPreviouslyPaid(
    orgId,
    studentDbId,
    studentName,
    data.ay,
    data.term,
    itemDescription
  );

  const remainingBeforePayment = Math.max(0, Math.round((rate - alreadyPaid) * 100) / 100);

  if (remainingBeforePayment <= 0 && !data.penaltyId) {
    throw new Error(`This assessment has already been fully paid at ₱${rate.toFixed(2)}.`);
  }

  const newTotalPaid = alreadyPaid + paid;
  const balanceDue = Math.max(0, Math.round((rate - newTotalPaid) * 100) / 100);

  const actualPaymentType = balanceDue === 0
    ? "Full Payment"
    : String(data.paymentType || "").trim() || "Partial Payment";

  // 5. Create Database Record & Execute Penalty Settlement Transaction if Applicable
  await prisma.$transaction(async (tx) => {
    await tx.collection.create({
      data: {
        organizationId: orgId,
        academicYear: data.ay,
        term: data.term,
        date,
        studentId: studentDbId,
        studentName,
        orNumber: String(data.orNumber || "").trim(),
        category,
        itemDescription,
        paymentType: actualPaymentType,
        standardRate: rate,
        amountPaid: paid,
        balanceDue,
        fundAllocation: String(data.fundAllocation || "").trim(),
        status: "Valid",
        encodedBy: officerName,
      },
    });

    // 🚀 PENALTY SETTLEMENT HOOK
    if (data.penaltyId) {
      const targetPen = await tx.penalty.findFirst({
        where: { penaltyId: data.penaltyId, organizationId: orgId },
      });

      if (targetPen) {
        const existingFine = Math.max(0, Number(targetPen.fineAmount) || 0);
        const remainingFine = Math.max(0, Math.round((existingFine - paid) * 100) / 100);

        const newStatus = remainingFine === 0
          ? `Settled (Cash Payment - ₱${paid.toFixed(2)})`
          : `Partially Paid (₱${paid.toFixed(2)} paid, ₱${remainingFine.toFixed(2)} remaining)`;

        await tx.penalty.update({
          where: { id: targetPen.id },
          data: { fineAmount: remainingFine, status: newStatus },
        });
      }
    }
  });

  // 6. Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "RECORD_PAYMENT",
        details: `Recorded payment of ₱${paid.toFixed(2)} from ${studentName} [OR: ${data.orNumber}] for ${itemDescription}.${data.penaltyId ? ` Settled penalty [${data.penaltyId}].` : ''}`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 7. Revalidate Cache
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}/penalties`);
  revalidatePath(`/department/${department}/clearance`);
  revalidatePath(`/department/${department}`);
}