import { Prisma } from '@prisma/client';
import type { Organization, TenantUser } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ApiFailure } from '@/lib/mobile/http';

export type RosterAction = 'create' | 'update' | 'enrollment';
export type RosterInput = {
  action: RosterAction;
  id?: string;
  studentId?: string;
  fullName?: string;
  yearLevel?: string;
  email?: string | null;
  enrollmentStatus?: string;
  expected?: {
    studentId: string; fullName: string; yearLevel: string;
    email: string | null; enrollmentStatus: string;
  };
  emailChangeIdentityVerified?: boolean;
};
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
type EnrollmentState = 'Enrolled' | 'Inactive';
const statusOf = (value: unknown): EnrollmentState | null => value === 'Enrolled' ? 'Enrolled' : value === 'Inactive' || value === 'Dropped' ? 'Inactive' : null;
const fail = (status: number, code: string, message: string): never => { throw new ApiFailure(status, code, message); };
const emailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (raw: RosterInput) => {
  const studentId = clean(raw.studentId);
  const fullName = clean(raw.fullName);
  const yearLevel = clean(raw.yearLevel) || 'Unassigned';
  const email = clean(raw.email).toLowerCase() || null;
  if (!studentId || studentId.length > 100 || /[\x00-\x1f\x7f]/.test(studentId)) {
    fail(400, 'invalid', 'Provide a valid student ID of at most 100 characters.');
  }
  if (!fullName || fullName.length > 200 || /[\x00-\x1f\x7f]/.test(fullName)) {
    fail(400, 'invalid', 'Provide a valid student name of at most 200 characters.');
  }
  if (yearLevel.length > 80 || /[\x00-\x1f\x7f]/.test(yearLevel)) {
    fail(400, 'invalid', 'Provide a valid year level.');
  }
  if (email && (email.length > 254 || !emailFormat.test(email))) {
    fail(400, 'invalid', 'Enter a valid student email address.');
  }
  const status = statusOf(raw.enrollmentStatus);
  if (!status) throw new ApiFailure(400, 'invalid', 'Choose Enrolled or Inactive.');
  return { studentId, fullName, yearLevel, email, status };
};

/**
 * Native roster writes mirror the existing web Students Roster restrictions:
 * active-tenant scope, current academic period, duplicate identity guards,
 * no financial-history ID rewrites, verified mailbox-change attestation,
 * durable audit, and a stale-edit conflict rather than overwriting a colleague.
 *
 * The API route re-authorizes tab-students before calling this function.
 */
export async function applyMobileRosterChange(org: Organization, actor: TenantUser, raw: RosterInput) {
  if (!['create', 'update', 'enrollment'].includes(raw?.action)) {
    fail(400, 'invalid', 'Unknown student roster operation.');
  }
  const existingId = clean(raw.id);
  if (raw.action !== 'create' && (!existingId || existingId.length > 100)) {
    fail(400, 'invalid', 'Select an existing student.');
  }
  if (!org.activeAy || !org.activeTerm) fail(409, 'period_closed', 'No active academic term is configured.');
  const actorName = actor.fullName || actor.email || 'Authorized Officer';
  let result;
  try {
  result = await prisma.$transaction(async tx => {
    // Never apply a roster change to a term captured before an Administrator
    // switched the organization's active academic period.
    const currentOrg = await tx.organization.findUnique({
      where: { id: org.id },
      select: { status: true, activeAy: true, activeTerm: true },
    });
    if (!currentOrg || currentOrg.status !== 'Active') {
      fail(403, 'forbidden', 'This department is no longer active.');
    }
    if (currentOrg.activeAy !== org.activeAy || currentOrg.activeTerm !== org.activeTerm) {
      fail(409, 'conflict', 'The academic period changed. Reload the roster before continuing.');
    }
    const closed = await tx.academicPeriodTransition.findUnique({
      where: { organizationId_sourceAY_sourceTerm: {
        organizationId: org.id, sourceAY: org.activeAy, sourceTerm: org.activeTerm,
      } }, select: { status: true },
    });
    if (closed?.status === 'Closed') fail(409, 'period_closed', 'This academic term is closed for roster changes.');
    const selected = raw.action === 'create' ? null : await tx.student.findFirst({
      where: { organizationId: org.id, id: existingId },
    });
    if (raw.action !== 'create' && !selected) throw new ApiFailure(404, 'not_found', 'Student not found in this department.');
    const currentEnrollment = selected ? await tx.enrollment.findUnique({
      where: { organizationId_academicYear_term_studentId: {
        organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm, studentId: selected.id,
      } },
    }) : null;
    const currentStatus = currentEnrollment?.enrollmentStatus === 'Enrolled' ? 'Enrolled' : 'Inactive';
    if (raw.action !== 'create') {
      const expected = raw.expected;
      if (!expected || clean(expected.studentId) !== selected!.studentId ||
          clean(expected.fullName) !== selected!.fullName ||
          clean(expected.yearLevel) !== selected!.yearLevel ||
          (clean(expected.email).toLowerCase() || null) !== (clean(selected!.email).toLowerCase() || null) ||
          statusOf(expected.enrollmentStatus) !== currentStatus) {
        fail(409, 'conflict', 'The student record or enrollment changed. Reload before editing.');
      }
    }

    if (raw.action === 'enrollment') {
      if (!selected) throw new ApiFailure(404, 'not_found', 'Student not found.');
      const next = statusOf(raw.enrollmentStatus);
      if (!next) throw new ApiFailure(400, 'invalid', 'Choose Enrolled or Inactive.');
      if (next === currentStatus) return { id: selected.id, status: next, changed: false };
      if (currentEnrollment) {
        const changed = await tx.enrollment.updateMany({
          where: { id: currentEnrollment.id, enrollmentStatus: currentEnrollment.enrollmentStatus },
          data: { enrollmentStatus: next, lastUpdated: new Date(), updatedBy: actorName },
        });
        if (changed.count !== 1) fail(409, 'conflict', 'Enrollment changed during editing. Refresh the roster.');
      } else {
        await tx.enrollment.create({ data: {
          organizationId: org.id, studentId: selected.id, academicYear: org.activeAy,
          term: org.activeTerm, enrollmentStatus: next, updatedBy: actorName,
        } });
      }
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: actorName, action: 'TOGGLE_STUDENT_STATUS',
        details: selected.studentId + ': ' + next + ' in ' + org.activeAy + ' ' + org.activeTerm + ' (Android)',
      } });
      return { id: selected.id, status: next, changed: true };
    }

    const student = normalize(raw);
    const duplicated = await tx.student.findFirst({
      where: { organizationId: org.id, studentId: { equals: student.studentId, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicated && duplicated.id !== selected?.id) fail(409, 'conflict', 'Student ID is already registered.');
    const emailChanged = (clean(selected?.email).toLowerCase() || null) !== student.email;
    if (selected && emailChanged) {
      if (raw.emailChangeIdentityVerified !== true) {
        fail(403, 'identity_review_required', 'Confirm the student identity review before changing the registered email.');
      }
      if (!student.email) fail(400, 'invalid', 'Do not remove a registered student email from the roster. Use authorized identity recovery.');
    }
    if (student.email && (emailChanged || !selected)) {
      const owner = await tx.student.findFirst({ where: {
        organizationId: org.id, ...(selected ? { id: { not: selected.id } } : {}),
        email: { equals: student.email, mode: 'insensitive' },
      }, select: { id: true } });
      if (owner) fail(409, 'conflict', 'This email belongs to another student in the department.');
    }
    if (selected && selected.studentId !== student.studentId) {
      const [collections, penalties, remittances, due] = await Promise.all([
        tx.collection.count({ where: { organizationId: org.id, studentId: selected.id } }),
        tx.penalty.count({ where: { organizationId: org.id, studentId: selected.studentId } }),
        tx.onlineRemittance.count({ where: { organizationId: org.id, studentId: selected.studentId } }),
        tx.collectible.findFirst({ where: {
          organizationId: org.id, status: { contains: 'SID:' + encodeURIComponent(selected.studentId) },
        }, select: { id: true } }),
      ]);
      if (collections + penalties + remittances > 0 || due) {
        fail(409, 'financial_history', 'Student ID is linked to financial history and cannot be changed.');
      }
    }
    let id: string;
    if (selected) {
      const updated = await tx.student.updateMany({
        where: {
          organizationId: org.id, id: selected.id, studentId: selected.studentId,
          fullName: selected.fullName, yearLevel: selected.yearLevel, email: selected.email,
        },
        data: { studentId: student.studentId, fullName: student.fullName,
          yearLevel: student.yearLevel, email: student.email },
      });
      if (updated.count !== 1) fail(409, 'conflict', 'Student details were changed by another officer. Reload.');
      id = selected.id;
    } else {
      const created = await tx.student.create({ data: {
        organizationId: org.id, studentId: student.studentId, fullName: student.fullName,
        yearLevel: student.yearLevel, email: student.email,
      } });
      id = created.id;
    }
    const enrollmentKey = { organizationId: org.id, academicYear: org.activeAy,
      term: org.activeTerm, studentId: id };
    if (currentEnrollment) {
      const changed = await tx.enrollment.updateMany({
        where: { id: currentEnrollment.id, enrollmentStatus: currentEnrollment.enrollmentStatus },
        data: { enrollmentStatus: student.status, lastUpdated: new Date(), updatedBy: actorName },
      });
      if (changed.count !== 1) fail(409, 'conflict', 'Enrollment changed during roster editing.');
    } else {
      await tx.enrollment.create({ data: { ...enrollmentKey,
        enrollmentStatus: student.status, updatedBy: actorName } });
    }
    if (selected && emailChanged) {
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: actorName, action: 'STUDENT_EMAIL_IDENTITY_REVIEW',
        details: 'Student record ' + selected.id +
          ': officer attested school-policy identity review; address changed; student OTP still required',
      } });
    }
    await tx.systemLog.create({ data: {
      organizationId: org.id, user: actorName, action: selected ? 'UPDATE_STUDENT' : 'CREATE_STUDENT',
      details: student.studentId + ' — ' + student.fullName + ' (Android)',
    } });
    return { id, status: student.status, changed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      fail(409, 'conflict', 'The roster changed during editing. Refresh the roster and retry.');
    }
    throw error;
  }
  if (result.changed) {
    // Match the existing web Students Roster invalidation targets. These pages
    // must not keep stale enrollment, clearance or summary state after a
    // correctly authorized Android roster mutation.
    for (const suffix of ['/students', '/clearance', '/reports', '/summary', '']) {
      revalidatePath('/department/' + org.subdomain + suffix);
    }
  }
  return { success: true as const, ...result };
}
