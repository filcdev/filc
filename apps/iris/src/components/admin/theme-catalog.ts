import { type SiteTheme, siteThemeIds } from '@filcdev/api/domains/theme';
import type { ThemeScheduleItem } from '@/hooks/site-theme';
import { formatLocalizedDate } from '@/utils/date-locale';

/**
 * The label keys for each skin, keyed by the contract's id list. Declaring it
 * as a `Record<SiteTheme, …>` is what makes a new skin a compile error until it
 * is named in both locales, instead of a missing card at runtime.
 *
 * Shared by the admin picker and the schedule dialog, so a schedule row is
 * named with the same copy as its card.
 */
export const THEME_COPY: Record<
  SiteTheme,
  { descriptionKey: string; nameKey: string }
> = {
  christmas: {
    descriptionKey: 'siteTheme.christmas.description',
    nameKey: 'siteTheme.christmas.name',
  },
  default: {
    descriptionKey: 'siteTheme.default.description',
    nameKey: 'siteTheme.default.name',
  },
  easter: {
    descriptionKey: 'siteTheme.easter.description',
    nameKey: 'siteTheme.easter.name',
  },
  halloween: {
    descriptionKey: 'siteTheme.halloween.description',
    nameKey: 'siteTheme.halloween.name',
  },
  march15: {
    descriptionKey: 'siteTheme.march15.description',
    nameKey: 'siteTheme.march15.name',
  },
  newYear: {
    descriptionKey: 'siteTheme.newYear.description',
    nameKey: 'siteTheme.newYear.name',
  },
  summer: {
    descriptionKey: 'siteTheme.summer.description',
    nameKey: 'siteTheme.summer.name',
  },
  valentines: {
    descriptionKey: 'siteTheme.valentines.description',
    nameKey: 'siteTheme.valentines.name',
  },
};

/** One entry per skin, in the contract's order (which is the calendar's). */
export const THEMES = siteThemeIds.map((id) => ({ id, ...THEME_COPY[id] }));

export type ThemeOption = (typeof THEMES)[number];

/**
 * One month/day in the reader's language. The date is built in a leap year so a
 * hand-edited 29 February renders as "Feb 29" instead of rolling over to
 * 1 March — such a row is never a valid window day (the API rejects it), but the
 * admin list must still be able to show what is stored.
 */
const formatMonthDay = (
  month: number,
  day: number,
  language: string | undefined
): string =>
  formatLocalizedDate(new Date(2024, month - 1, day), language, {
    day: 'numeric',
    month: 'short',
  });

/** A schedule row's window as `start → end`, both ends in the reader's locale. */
export const windowText = (
  item: Pick<
    ThemeScheduleItem,
    'startMonth' | 'startDay' | 'endMonth' | 'endDay'
  >,
  language: string | undefined
): string =>
  `${formatMonthDay(item.startMonth, item.startDay, language)} → ${formatMonthDay(
    item.endMonth,
    item.endDay,
    language
  )}`;
