/** Normalize a day name for accent/case-insensitive matching. */
const normalizeDayText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Weekday index (0 = Sunday … 6 = Saturday) for a date in Europe/Budapest. */
export const getWeekdayInBudapest = (value: Date): number => {
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Budapest',
    weekday: 'short',
  }).format(value);
  const weekdayIndex = {
    Fri: 5,
    Mon: 1,
    Sat: 6,
    Sun: 0,
    Thu: 4,
    Tue: 2,
    Wed: 3,
  }[weekdayName];
  if (weekdayIndex === undefined) {
    throw new Error(`Unsupported weekday value: ${weekdayName}`);
  }
  return weekdayIndex;
};

const weekdayAliases: Record<number, string[]> = {
  0: ['vasarnap', 'va', 'v', 'sunday', 'sun'],
  1: ['hetfo', 'he', 'h', 'monday', 'mon'],
  2: ['kedd', 'ke', 'k', 'tuesday', 'tue'],
  3: ['szerda', 'sze', 'sz', 'wednesday', 'wed'],
  4: ['csutortok', 'cs', 'thursday', 'thu'],
  5: ['pentek', 'pe', 'p', 'friday', 'fri'],
  6: ['szombat', 'szo', 'saturday', 'sat'],
};

/** Whether a day definition's name/short matches the given weekday index. */
export const isMatchingWeekday = (
  weekdayIndex: number,
  dayName: string,
  dayShort?: string
): boolean => {
  const aliases = (weekdayAliases[weekdayIndex] ?? []).map(normalizeDayText);
  const normalizedName = normalizeDayText(dayName);
  const normalizedShort = dayShort ? normalizeDayText(dayShort) : '';

  const matchesAlias = (alias: string): boolean => {
    if (normalizedName === alias || normalizedShort === alias) {
      return true;
    }
    if (alias.length <= 3) {
      return normalizedName.startsWith(alias);
    }
    return normalizedName.includes(alias);
  };
  return aliases.some(matchesAlias);
};
