import { describe, expect, it } from 'bun:test';
import { formatEventAnswer, newEventFieldDraft } from './event-fields';

describe('newEventFieldDraft', () => {
  it('starts on every form, so no category can hide it', () => {
    expect(newEventFieldDraft().audiences).toEqual([
      'guest',
      'student',
      'helper',
    ]);
  });

  it('mints a fresh key for every row', () => {
    expect(newEventFieldDraft().key).not.toBe(newEventFieldDraft().key);
  });
});

describe('formatEventAnswer', () => {
  const yesNo: Record<string, string> = {
    'common.no': 'Nem',
    'common.yes': 'Igen',
  };
  const t = (key: string) => yesNo[key] ?? key;

  it('spells a checkbox answer as a word, never true/false', () => {
    expect(formatEventAnswer('checkbox', 'true', t)).toBe('Igen');
    expect(formatEventAnswer('checkbox', 'false', t)).toBe('Nem');
  });

  it('leaves every other answer verbatim, with a dash when empty', () => {
    expect(formatEventAnswer('text', 'test2', t)).toBe('test2');
    expect(formatEventAnswer('number', '', t)).toBe('—');
  });
});
