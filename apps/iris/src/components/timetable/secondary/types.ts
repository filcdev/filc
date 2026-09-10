import type { LessonItem } from '../types';

/**
 * A single period column of the secondary (paper-like) timetable card.
 * `index` is the canonical period number (0–16); `startLabel`/`endLabel` are
 * the already-formatted HH:mm clock strings shown in the header row (e.g.
 * "7:10" / "7:55").
 */
export type SecondaryPeriod = {
  index: number;
  id: string;
  startTime: string;
  endTime: string;
  startLabel: string;
  endLabel: string;
};

/** One weekday row of the card, keyed by its 0–4 Monday–Friday order. */
export type SecondaryDay = {
  order: number;
  key: string;
  label: string;
};

/**
 * The derived view model for the secondary timetable card.
 *
 * `grid` maps `"${day.order}|${period.index}"` to the lessons occupying that
 * slot. A slot with a single lesson renders as a full-height cell; a slot with
 * two lessons renders as a vertically split (A-week / B-week) cell.
 */
export type SecondaryTimetableModel = {
  days: SecondaryDay[];
  periods: SecondaryPeriod[];
  grid: Map<string, LessonItem[]>;
};

/**
 * The header info shown in the grid's top-left corner cell: the class code.
 */
export type SecondaryTimetableHeader = {
  /** Large class code (e.g. "11.D"). */
  classCode: string;
};
