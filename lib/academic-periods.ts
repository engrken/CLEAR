/** CLEAR academic periods. Pure/shared: safe in both client and server bundles. */
export type CalendarMode = "Semester" | "Trimester" | "FullYear";
export type CalendarConfig = { mode: CalendarMode; includeSummer: boolean };
export type CalendarByYear = Record<string, CalendarConfig>;
export type AccountingPeriod = { ay: string; term: string };

export const LEGACY_CALENDAR: CalendarConfig = { mode: "Semester", includeSummer: true };
export function isCalendarMode(input: string): input is CalendarMode {
  return input === "Semester" || input === "Trimester" || input === "FullYear";
}
export function periodsFor(config: CalendarConfig): string[] {
  if (config.mode === "FullYear") return ["Full Year"];
  if (config.mode === "Trimester") return ["1st Trimester", "2nd Trimester", "3rd Trimester"];
  return config.includeSummer ? ["1st Sem", "2nd Sem", "Summer"] : ["1st Sem", "2nd Sem"];
}
export function configurationForYear(ay: string, byYear: CalendarByYear): CalendarConfig {
  if (byYear[ay]) return byYear[ay];
  const start = academicYearStart(ay);
  const past = Object.keys(byYear)
    .map(key => ({ key, year: academicYearStart(key) }))
    .filter(row => row.year <= start)
    .sort((a, b) => b.year - a.year)[0];
  return past ? byYear[past.key] : LEGACY_CALENDAR;
}
export function academicYearStart(ay: string): number {
  const m = /^(?:A\.Y\.\s*)?(\d{4})\s*-\s*(\d{4})$/.exec(ay.trim());
  if (!m || Number(m[2]) !== Number(m[1]) + 1) {
    throw new Error("Academic year must look like A.Y. 2026 - 2027.");
  }
  return Number(m[1]);
}
export function followingAcademicYear(ay: string): string {
  const start = academicYearStart(ay) + 1;
  return `A.Y. ${start} - ${start + 1}`;
}
export function isValidPeriod(ay: string, term: string, config: CalendarConfig): boolean {
  try { academicYearStart(ay); } catch { return false; }
  return periodsFor(config).includes(term);
}
export function followingPeriod(ay: string, term: string, byYear: CalendarByYear): AccountingPeriod {
  const terms = periodsFor(configurationForYear(ay, byYear));
  const position = terms.indexOf(term);
  if (position < 0) throw new Error(`Term "${term}" is not enabled for ${ay}.`);
  // Backward compatibility: before tenant calendar settings existed, CLEAR carried
  // 2nd Sem straight to the following A.Y.; Summer was an optional standalone
  // accounting period. Do not silently change historical rollover behavior.
  const applicableConfigExists = Object.keys(byYear).some(year => {
    try { return academicYearStart(year) <= academicYearStart(ay); } catch { return false; }
  });
  if (!applicableConfigExists && term === "2nd Sem") {
    const nextAy = followingAcademicYear(ay);
    return { ay: nextAy, term: periodsFor(configurationForYear(nextAy, byYear))[0] };
  }
  if (position < terms.length - 1) return { ay, term: terms[position + 1] };
  const nextAy = followingAcademicYear(ay);
  return { ay: nextAy, term: periodsFor(configurationForYear(nextAy, byYear))[0] };
}
