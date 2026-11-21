import { describe, expect, it } from 'bun:test';
import { getDayPickerLocaleConfig } from '@filcdev/ui/lib/day-picker-locale';
import { enUS, hu } from 'react-day-picker/locale';

describe('getDayPickerLocaleConfig', () => {
  it('starts the week on Monday in English and keeps English names', () => {
    const config = getDayPickerLocaleConfig('en-US');

    expect(config.weekStartsOn).toBe(1);
    expect(config.locale).toBe(enUS);
  });

  it('starts the week on Monday in Hungarian and keeps Hungarian names', () => {
    const config = getDayPickerLocaleConfig('hu-HU');

    expect(config.weekStartsOn).toBe(1);
    expect(config.locale).toBe(hu);
  });

  it('falls back to Hungarian when the language is missing', () => {
    expect(getDayPickerLocaleConfig(undefined)).toEqual({
      locale: hu,
      weekStartsOn: 1,
    });
  });
});
