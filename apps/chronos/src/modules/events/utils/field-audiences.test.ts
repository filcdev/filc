import { describe, expect, it } from 'bun:test';
import type { EventField } from '@filcdev/api/domains/events/fields';
import { checkAnswers } from '#modules/events/utils/answers';
import { filterFieldsForAudiences } from '#modules/events/utils/events';

const field = (id: string, audiences: EventField['audiences']): EventField => ({
  audiences,
  eventId: '5b4d1f1e-9c3a-4a2e-8b1f-0d2c3b4a5f60',
  id,
  label: id,
  options: null,
  position: 0,
  required: false,
  type: 'text',
});

const GUEST = field('guest-only', ['guest']);
const STUDENT = field('student-only', ['student']);
const HELPER = field('helper-only', ['helper']);
const SHARED = field('shared', ['guest', 'student']);
const ALL = field('all', ['guest', 'student', 'helper']);
const FIELDS = [GUEST, STUDENT, HELPER, SHARED, ALL];
const ids = (fields: readonly EventField[]) => fields.map((entry) => entry.id);

describe('filterFieldsForAudiences', () => {
  it('shows the guest form the guest questions', () => {
    expect(ids(filterFieldsForAudiences(FIELDS, ['guest']))).toEqual([
      'guest-only',
      'shared',
      'all',
    ]);
  });

  it('shows the signed-in form the student and helper questions', () => {
    // One form serves participants and helpers, so it is the union.
    expect(
      ids(filterFieldsForAudiences(FIELDS, ['student', 'helper']))
    ).toEqual(['student-only', 'helper-only', 'shared', 'all']);
  });

  it('rejects an answer to a question the form does not show', () => {
    const guestForm = filterFieldsForAudiences(FIELDS, ['guest']);
    const signedInForm = filterFieldsForAudiences(FIELDS, [
      'student',
      'helper',
    ]);

    expect(
      checkAnswers(guestForm, [{ fieldId: STUDENT.id, value: 'x' }]).ok
    ).toBe(false);
    expect(
      checkAnswers(guestForm, [{ fieldId: HELPER.id, value: 'x' }]).ok
    ).toBe(false);
    expect(
      checkAnswers(signedInForm, [{ fieldId: GUEST.id, value: 'x' }]).ok
    ).toBe(false);
    expect(
      checkAnswers(signedInForm, [{ fieldId: HELPER.id, value: 'x' }]).ok
    ).toBe(true);
  });
});
