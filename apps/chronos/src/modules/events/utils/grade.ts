/** The cohort fields a grade can be read from. */
export type CohortLabel = { name: string; short: string };

const GRADE_PREFIX = /^(\d{1,2})/;

/**
 * The grade a label starts with: one or two digits, as in `9.A`, `10.B` and
 * `13.E`.
 *
 * A bilingual label names a year and a grade — `1/13.RS` is the first year of
 * grade 13, `2/14.VL` the second year of 14 — so its leading digits are the
 * year, not the grade. Those answer null instead: reading `1/13.RS` as grade 1
 * would silently bar a 13th-grader from every event with a grade bound, while an
 * unknown grade refuses with a reason the student can act on.
 */
const gradeFromLabel = (label: string): number | null => {
  if (label.includes('/')) {
    return null;
  }
  const match = GRADE_PREFIX.exec(label.trim());
  if (!match?.[1]) {
    return null;
  }
  const grade = Number(match[1]);
  // The school runs grades 1-13; anything else is a label we cannot trust.
  return grade >= 1 && grade <= 13 ? grade : null;
};

/**
 * The grade a student's cohort implies, or null when it cannot be read. The
 * short name is what the timetable displays, so it is tried first.
 */
export const cohortGrade = (
  cohort: CohortLabel | null | undefined
): number | null => {
  if (!cohort) {
    return null;
  }
  return gradeFromLabel(cohort.short) ?? gradeFromLabel(cohort.name);
};
