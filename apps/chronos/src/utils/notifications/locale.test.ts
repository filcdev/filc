import { describe, expect, it } from 'bun:test';
import { mailLocale } from '#utils/notifications/locale';

describe('mailLocale', () => {
  it('resolves English tags and their regional variants to en', () => {
    for (const locale of ['en', 'EN', 'en-US', 'en-GB', '  en  ']) {
      expect(mailLocale(locale)).toBe('en');
    }
  });

  it('resolves Hungarian tags and their regional variants to hu', () => {
    for (const locale of ['hu', 'hu-HU', 'HU']) {
      expect(mailLocale(locale)).toBe('hu');
    }
  });

  it('falls back to the hu default for anything that is not English', () => {
    for (const locale of ['', undefined, null, 'de', 'de-DE']) {
      expect(mailLocale(locale)).toBe('hu');
    }
  });
});
