import { describe, expect, it } from 'bun:test';
import { cohortGrade } from '#modules/events/utils/grade';

/**
 * The 35 cohorts the dev database holds, copied from the timetable import, so
 * the parser is pinned against the labels the school actually uses.
 */
const REAL_COHORTS = [
  '10.A',
  '10.B',
  '10.C',
  '10.D',
  '10.E',
  '1/13.RS',
  '1/13.VL',
  '1/15.GyL',
  '1/15.SZL',
  '11.A',
  '11.B',
  '11.C',
  '11.D',
  '11.E',
  '11.G',
  '12.A',
  '12.B',
  '12.C',
  '12.D',
  '12.E',
  '13.A',
  '13.B',
  '13.C',
  '13.D',
  '13.E',
  '2/14.R',
  '2/14.RL',
  '2/14.S',
  '2/14.VL',
  '9.A',
  '9.B',
  '9.C',
  '9.D',
  '9.E',
  '9.KNY',
].map((label) => ({ name: label, short: label }));

describe('cohortGrade', () => {
  it('reads the grade out of every real cohort label', () => {
    expect(REAL_COHORTS.map((c) => [c.short, cohortGrade(c)])).toEqual([
      ['10.A', 10],
      ['10.B', 10],
      ['10.C', 10],
      ['10.D', 10],
      ['10.E', 10],
      // Bilingual labels name a year and a grade: `1/13` is the first year of
      // grade 13, so the leading digits are not the grade. Unknown, so an event
      // with a grade bound refuses with a reason instead of barring a 13th grader.
      ['1/13.RS', null],
      ['1/13.VL', null],
      ['1/15.GyL', null],
      ['1/15.SZL', null],
      ['11.A', 11],
      ['11.B', 11],
      ['11.C', 11],
      ['11.D', 11],
      ['11.E', 11],
      ['11.G', 11],
      ['12.A', 12],
      ['12.B', 12],
      ['12.C', 12],
      ['12.D', 12],
      ['12.E', 12],
      ['13.A', 13],
      ['13.B', 13],
      ['13.C', 13],
      ['13.D', 13],
      ['13.E', 13],
      ['2/14.R', null],
      ['2/14.RL', null],
      ['2/14.S', null],
      ['2/14.VL', null],
      ['9.A', 9],
      ['9.B', 9],
      ['9.C', 9],
      ['9.D', 9],
      ['9.E', 9],
      ['9.KNY', 9],
    ]);
  });

  it('has no cohort without a label', () => {
    expect(cohortGrade(null)).toBe(null);
    expect(cohortGrade(undefined)).toBe(null);
  });

  it('falls back to the name when the short label names nothing', () => {
    expect(cohortGrade({ name: '12.C', short: '' })).toBe(12);
    expect(cohortGrade({ name: '12.C', short: 'Osztály' })).toBe(12);
  });

  it('fails closed on a label it cannot read', () => {
    expect(cohortGrade({ name: 'Vegyes', short: 'Vegyes' })).toBe(null);
    expect(cohortGrade({ name: '14.A', short: '14.A' })).toBe(null);
    expect(cohortGrade({ name: '0.X', short: '0.X' })).toBe(null);
  });
});
