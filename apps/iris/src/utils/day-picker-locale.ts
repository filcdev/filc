import type { DayPickerLocale } from 'react-day-picker';
import { enUS, hu } from 'react-day-picker/locale';
import { getLanguageCode } from './date-locale';

export type DayPickerLocaleConfig = {
  locale: DayPickerLocale;
  /** `hu` is Monday-first; `en-US` keeps DayPicker's own Sunday default. */
  weekStartsOn: 1 | undefined;
};

/**
 * DayPicker carries its own month, weekday and aria strings per locale, so the
 * app's language decides the whole calendar instead of hand-written labels.
 * Hungarian is Monday-first; English keeps `en-US`'s Sunday start.
 */
export function getDayPickerLocaleConfig(
  language: string | undefined
): DayPickerLocaleConfig {
  if (getLanguageCode(language) === 'en') {
    return { locale: enUS, weekStartsOn: undefined };
  }

  return { locale: hu, weekStartsOn: 1 };
}
