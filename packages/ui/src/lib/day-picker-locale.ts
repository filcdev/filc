import type { DayPickerLocale } from 'react-day-picker';
import { enUS, hu } from 'react-day-picker/locale';

export type DayPickerLocaleConfig = {
  locale: DayPickerLocale;
  weekStartsOn: 1;
};

/**
 * Every calendar starts its week on Monday; the language only picks the names
 * of the months and weekdays. Defaulting to Hungarian keeps an unknown or
 * missing language on the school's own locale instead of `en-US`.
 */
export function getDayPickerLocaleConfig(
  language: string | undefined
): DayPickerLocaleConfig {
  const code = (language ?? 'hu').toLowerCase().split('-')[0] ?? 'hu';

  return { locale: code === 'en' ? enUS : hu, weekStartsOn: 1 };
}
