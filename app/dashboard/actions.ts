// /app/dashboard/actions.ts
'use server';

import { provisionEntityWithTier } from './provisions/actions';
import { isCalendarMode, academicYearStart, type CalendarMode } from '@/lib/academic-periods';
import { updateEntityLogo } from '@/app/department/[department]/(protected)/setup/actions';

/** Legacy dashboard modal entry point. Uses the same authorization, group limits,
 * tenant creation and audit logging as the Master Provisions page. */
export async function createDepartment(formData: FormData) {
  try {
    const logo = formData.get('logo');
    if (logo instanceof File && logo.size > 0) {
      if (logo.size > 2 * 1024 * 1024) {
        return { success: false, message: 'Logo must be 2 MB or smaller.' };
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(logo.type)) {
        return { success: false, message: 'Logo must be PNG, JPEG or WebP.' };
      }
    }

    const initialAcademicYear = String(formData.get('initialAcademicYear') || '').trim();
    const selectedMode = String(formData.get('calendarMode') || '').trim();
    academicYearStart(initialAcademicYear);
    if (!isCalendarMode(selectedMode)) {
      return { success: false, message: 'Choose Full School Year, Semester or Trimester.' };
    }
    const calendarMode: CalendarMode = selectedMode;
    const includeSummer = calendarMode === 'Semester' &&
      ['on', 'true', '1'].includes(String(formData.get('includeSummer')).toLowerCase());

    const result = await provisionEntityWithTier({
      name: String(formData.get('name') ?? ''),
      subdomain: String(formData.get('acronym') || formData.get('subdomain') || ''),
      schoolGroup: String(formData.get('schoolGroup') || 'default-school'),
      tier: 'Freemium',
      type: String(formData.get('type') || 'Department'),
      adminName: String(formData.get('adminName') ?? ''),
      adminEmail: String(formData.get('adminEmail') ?? ''),
      adminUsername: String(formData.get('adminUsername') ?? ''),
      initialAcademicYear,
      calendarMode,
      includeSummer,
    });

    if (logo instanceof File && logo.size > 0 && result.organizationId) {
      const imageForm = new FormData();
      imageForm.set('organizationId', result.organizationId);
      imageForm.set('logo', logo);
      try {
        const uploaded = await updateEntityLogo(imageForm);
        if (!uploaded.success) {
          return { success: true, message: `${result.message} Logo not uploaded: ${uploaded.message}` };
        }
      } catch {
        return { success: true, message: `${result.message} Logo upload did not complete. Upload the logo later in Organization Setup.` };
      }
    }
    return { success: true, message: result.message };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Unable to provision the entity.' };
  }
}
