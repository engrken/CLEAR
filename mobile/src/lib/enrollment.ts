import type { Student } from '@/api';

type Status = Student['enrollmentStatus'];

/** Only enrolled students can be charged. */
export const isEnrolled = (s: Status) => s === 'Enrolled';

/** The roster word to show: the web app now says "Inactive" for a dropped student. */
export const enrollmentLabel = (s: Status): string => (s === 'Dropped' ? 'Inactive' : s);
