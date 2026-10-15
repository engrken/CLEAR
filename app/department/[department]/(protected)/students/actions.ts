// /app/department/[department]/(protected)/students/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export async function toggleStudentStatus(department: string, studentId: string, currentStatus: string, ay: string, term: string) {
  const cleanDept = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-students', cleanDept);

  const newStatus = currentStatus === 'Enrolled' ? 'Inactive' : 'Enrolled';
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return { success: false, message: "Student not found" };

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, academicYear: ay, term },
  });

  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: { enrollmentStatus: newStatus },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        organizationId: student.organizationId,
        academicYear: ay,
        term,
        enrollmentStatus: newStatus,
      },
    });
  }
  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true };
}

export async function confirmAllEnrolled(department: string, organizationId: string, ay: string, term: string) {
  const cleanDept = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-students', cleanDept);

  const allStudents = await prisma.student.findMany({ where: { organizationId } });
  for (const student of allStudents) {
    const existing = await prisma.enrollment.findFirst({
      where: { studentId: student.id, academicYear: ay, term },
    });
    if (existing) {
      await prisma.enrollment.update({ where: { id: existing.id }, data: { enrollmentStatus: 'Enrolled' } });
    } else {
      await prisma.enrollment.create({
        data: { studentId: student.id, organizationId, academicYear: ay, term, enrollmentStatus: 'Enrolled' },
      });
    }
  }
  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true, count: allStudents.length };
}

export async function promoteYearLevels(department: string, organizationId: string) {
  const cleanDept = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-students', cleanDept);

  const students = await prisma.student.findMany({ where: { organizationId } });
  let promoted = 0;
  for (const s of students) {
    let nextYear = s.yearLevel;
    if (s.yearLevel === '1st Year') nextYear = '2nd Year';
    else if (s.yearLevel === '2nd Year') nextYear = '3rd Year';
    else if (s.yearLevel === '3rd Year') nextYear = '4th Year';
    else if (s.yearLevel === '4th Year') nextYear = 'Graduated / Alumni';

    if (nextYear !== s.yearLevel) {
      await prisma.student.update({ where: { id: s.id }, data: { yearLevel: nextYear } });
      promoted++;
    }
  }
  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true, promoted };
}

export async function saveStudent(department: string, organizationId: string, ay: string, term: string, formData: {
  id?: string;
  studentId: string;
  fullName: string;
  yearLevel: string;
  email?: string;
  enrollmentStatus?: string;
  isEdit: boolean;
  originalId?: string;
}) {
  const cleanDept = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-students', cleanDept);

  if (!formData.studentId || !formData.fullName) {
    throw new Error("Student ID and Full Name are required.");
  }

  if (formData.isEdit && formData.id) {
    await prisma.student.update({
      where: { id: formData.id },
      data: {
        studentId: formData.studentId,
        fullName: formData.fullName,
        yearLevel: formData.yearLevel,
        email: formData.email || null,
      },
    });

    if (formData.enrollmentStatus) {
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { studentId: formData.id, academicYear: ay, term },
      });
      if (existingEnrollment) {
        await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { enrollmentStatus: formData.enrollmentStatus },
        });
      } else {
        await prisma.enrollment.create({
          data: { studentId: formData.id, organizationId, academicYear: ay, term, enrollmentStatus: formData.enrollmentStatus },
        });
      }
    }
  } else {
    const newStudent = await prisma.student.create({
      data: {
        studentId: formData.studentId,
        fullName: formData.fullName,
        yearLevel: formData.yearLevel,
        email: formData.email || null,
        organizationId,
      },
    });

    await prisma.enrollment.create({
      data: {
        studentId: newStudent.id,
        organizationId,
        academicYear: ay,
        term,
        enrollmentStatus: formData.enrollmentStatus || 'Enrolled',
      },
    });
  }

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true };
}

export async function deleteStudent(department: string, studentInternalId: string) {
  const cleanDept = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-students', cleanDept);

  const org = await prisma.organization.findUnique({
    where: { subdomain: cleanDept },
    select: { id: true },
  });

  if (!org) throw new Error('Department not found.');

  const student = await prisma.student.findFirst({
    where: { id: studentInternalId, organizationId: org.id },
  });

  if (!student) throw new Error('Student record not found.');

  // Perform atomic transaction cleanup to maintain relational integrity (Item 4 fix)
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.deleteMany({ where: { studentId: studentInternalId, organizationId: org.id } });
    await tx.student.delete({ where: { id: studentInternalId } });
  });

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true };
}

export async function bulkImportStudents(department: string, organizationId: string, ay: string, term: string, records: Array<{ studentId: string; fullName: string; yearLevel: string; email?: string }>) {
  const cleanDept = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess('tab-students', cleanDept);

  let added = 0;
  let updated = 0;

  for (const r of records) {
    if (!r.studentId || !r.fullName) continue;

    const existing = await prisma.student.findFirst({
      where: { organizationId, studentId: { equals: r.studentId, mode: 'insensitive' } },
    });

    let studentRecordId: string;

    if (existing) {
      await prisma.student.update({
        where: { id: existing.id },
        data: { fullName: r.fullName, yearLevel: r.yearLevel || existing.yearLevel, email: r.email || existing.email },
      });
      studentRecordId = existing.id;
      updated++;
    } else {
      const created = await prisma.student.create({
        data: {
          studentId: r.studentId,
          fullName: r.fullName,
          yearLevel: r.yearLevel || '1st Year',
          email: r.email || null,
          organizationId,
        },
      });
      studentRecordId = created.id;
      added++;
    }

    const enrollExists = await prisma.enrollment.findFirst({
      where: { studentId: studentRecordId, academicYear: ay, term },
    });

    if (enrollExists) {
      await prisma.enrollment.update({
        where: { id: enrollExists.id },
        data: { enrollmentStatus: 'Enrolled' },
      });
    } else {
      await prisma.enrollment.create({
        data: { studentId: studentRecordId, organizationId, academicYear: ay, term, enrollmentStatus: 'Enrolled' },
      });
    }
  }

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true, message: `Successfully imported: ${added} added, ${updated} updated.` };
}