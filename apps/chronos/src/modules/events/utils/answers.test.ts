import { describe, expect, it } from 'bun:test';
import type { EventField } from '@filcdev/api/domains/events/fields';
import { checkAnswers } from '#modules/events/utils/answers';

const field = (overrides: Partial<EventField>): EventField => ({
  audiences: ['student'],
  eventId: '00000000-0000-4000-8000-000000000001',
  id: '00000000-0000-4000-8000-000000000010',
  label: 'Question',
  options: null,
  position: 0,
  required: false,
  type: 'text',
  ...overrides,
});

const TEXT = field({
  id: '00000000-0000-4000-8000-000000000010',
  label: 'Name',
});
const CHOICE = field({
  id: '00000000-0000-4000-8000-000000000011',
  label: 'Diet',
  options: ['vegan', 'none'],
  type: 'select',
});
const NUMBER = field({
  id: '00000000-0000-4000-8000-000000000012',
  label: 'Guests',
  type: 'number',
});
const REQUIRED = field({
  id: '00000000-0000-4000-8000-000000000013',
  label: 'Allergy',
  required: true,
});

const FIELDS = [TEXT, CHOICE, NUMBER, REQUIRED];

const message = (
  answers: { fieldId: string; value: string }[]
): string | null => {
  const result = checkAnswers(FIELDS, answers);
  return result.ok ? null : result.message;
};

describe('checkAnswers', () => {
  it('accepts a complete, valid answer set', () => {
    expect(
      checkAnswers(FIELDS, [
        { fieldId: TEXT.id, value: 'Anna' },
        { fieldId: CHOICE.id, value: 'vegan' },
        { fieldId: NUMBER.id, value: '2' },
        { fieldId: REQUIRED.id, value: 'nuts' },
      ])
    ).toEqual({
      answers: [
        { fieldId: TEXT.id, value: 'Anna' },
        { fieldId: CHOICE.id, value: 'vegan' },
        { fieldId: NUMBER.id, value: '2' },
        { fieldId: REQUIRED.id, value: 'nuts' },
      ],
      ok: true,
    });
  });

  it('rejects a question that is not on the student form', () => {
    expect(
      message([{ fieldId: '00000000-0000-4000-8000-0000000000ff', value: 'x' }])
    ).toBe('That question is not on this signup form');
  });

  it('rejects the same question twice', () => {
    expect(
      message([
        { fieldId: TEXT.id, value: 'a' },
        { fieldId: TEXT.id, value: 'b' },
      ])
    ).toBe('Each question can be answered once');
  });

  it('requires a required question, and treats an empty value as unanswered', () => {
    expect(message([])).toBe('"Allergy" is required');
    expect(message([{ fieldId: REQUIRED.id, value: '   ' }])).toBe(
      '"Allergy" is required'
    );
  });

  it('checks a choice against its options', () => {
    expect(message([{ fieldId: CHOICE.id, value: 'meat' }])).toBe(
      '"Diet" must be one of its options'
    );
    expect(
      message([
        { fieldId: CHOICE.id, value: 'none' },
        { fieldId: REQUIRED.id, value: 'nuts' },
      ])
    ).toBe(null);
  });

  it('lets an optional choice be cleared', () => {
    expect(
      message([
        { fieldId: CHOICE.id, value: '' },
        { fieldId: REQUIRED.id, value: 'nuts' },
      ])
    ).toBe(null);
  });

  it('still requires a required choice to name one of its options', () => {
    const requiredChoice = field({
      id: '00000000-0000-4000-8000-000000000014',
      label: 'Workshop',
      options: ['robotics', 'chess'],
      required: true,
      type: 'select',
    });

    expect(
      checkAnswers(
        [requiredChoice],
        [{ fieldId: requiredChoice.id, value: '' }]
      )
    ).toEqual({ message: '"Workshop" is required', ok: false });
  });

  it('checks that a number parses', () => {
    expect(message([{ fieldId: NUMBER.id, value: 'two' }])).toBe(
      '"Guests" must be a number'
    );
    expect(
      message([
        { fieldId: NUMBER.id, value: '2' },
        { fieldId: REQUIRED.id, value: 'nuts' },
      ])
    ).toBe(null);
  });

  it('leaves optional questions alone when they are omitted', () => {
    expect(message([{ fieldId: REQUIRED.id, value: 'nuts' }])).toBe(null);
  });
});
