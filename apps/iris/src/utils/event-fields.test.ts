import { describe, expect, it } from 'bun:test';
import { newEventFieldDraft } from './event-fields';

describe('newEventFieldDraft', () => {
  it('starts on both forms, so no category can hide it from students', () => {
    expect(newEventFieldDraft().appliesTo).toBe('both');
  });

  it('mints a fresh key for every row', () => {
    expect(newEventFieldDraft().key).not.toBe(newEventFieldDraft().key);
  });
});
