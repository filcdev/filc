import { describe, expect, it } from 'bun:test';
import { newEventFieldDraft } from './event-fields';

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
