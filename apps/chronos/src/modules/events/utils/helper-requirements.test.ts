import { describe, expect, it } from 'bun:test';
import type { EventHelperRequirement } from '@filcdev/api/domains/events/event';
import type { EventField } from '@filcdev/api/domains/events/fields';
import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';
import {
  firstUnmetHelperRequirement,
  helperRequirementRefusalMessage,
} from '#modules/events/utils/helper-requirement-match';
import {
  assertHelperRequirements,
  normaliseHelperText,
} from '#modules/events/utils/helper-requirements';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const FIELD = '22222222-2222-4222-8222-222222222222';

const field = (overrides: Partial<EventField> = {}): EventField => ({
  audiences: ['student', 'helper'],
  eventId: EVENT_ID,
  id: FIELD,
  label: 'Szakirány',
  options: null,
  position: 0,
  required: false,
  type: 'text',
  ...overrides,
});

const requirement = (
  overrides: Partial<EventHelperRequirement> = {}
): EventHelperRequirement => ({
  fieldId: FIELD,
  op: 'equals',
  value: 'Informatika',
  ...overrides,
});

const answer = (value: string): EventRegistrationAnswer[] => [
  { fieldId: FIELD, value },
];

const unmet = (
  fields: EventField[],
  requirements: EventHelperRequirement[],
  answers: EventRegistrationAnswer[]
) => firstUnmetHelperRequirement(fields, requirements, answers);

describe('normaliseHelperText', () => {
  it('ignores case and accents', () => {
    expect(normaliseHelperText('  Informatika ')).toBe('informatika');
    expect(normaliseHelperText('INFORMATIKA')).toBe('informatika');
    expect(normaliseHelperText('Környezetvédelem')).toBe('kornyezetvedelem');
  });
});

describe('firstUnmetHelperRequirement', () => {
  it('matches text with equals ignoring case and accents', () => {
    const fields = [field({ type: 'text' })];
    expect(
      unmet(fields, [requirement()], answer('  INFORMATIKA  '))
    ).toBeNull();
    expect(
      unmet(
        fields,
        [requirement({ value: 'Környezetvédelem' })],
        answer('kornyezetvedelem')
      )
    ).toBeNull();
    expect(unmet(fields, [requirement()], answer('matek'))).toEqual({
      fieldId: FIELD,
      label: 'Szakirány',
    });
  });

  it('matches text with contains on the normalised form', () => {
    const fields = [field({ type: 'text' })];
    const contains = requirement({ op: 'contains', value: 'informatika' });
    expect(unmet(fields, [contains], answer('Szak: INFORMATIKA'))).toBeNull();
    expect(unmet(fields, [contains], answer('Szak: matematika'))).toEqual({
      fieldId: FIELD,
      label: 'Szakirány',
    });
  });

  it('matches a select option case/diacritic-insensitively', () => {
    const fields = [
      field({ options: ['Informatika', 'Környezetvédelem'], type: 'select' }),
    ];
    expect(
      unmet(
        fields,
        [requirement({ value: 'Környezetvédelem' })],
        answer('KORNYEZETVEDELEM')
      )
    ).toBeNull();
    expect(unmet(fields, [requirement()], answer('matek'))).toEqual({
      fieldId: FIELD,
      label: 'Szakirány',
    });
  });

  it('compares numbers numerically', () => {
    const fields = [field({ type: 'number' })];
    expect(
      unmet(
        fields,
        [requirement({ op: 'equals', value: '10' })],
        answer('10.0')
      )
    ).toBeNull();
    expect(
      unmet(fields, [requirement({ op: 'gte', value: '9.5' })], answer('10'))
    ).toBeNull();
    expect(
      unmet(fields, [requirement({ op: 'gte', value: '10.5' })], answer('10'))
    ).toEqual({ fieldId: FIELD, label: 'Szakirány' });
    expect(
      unmet(fields, [requirement({ op: 'lte', value: '10' })], answer('10'))
    ).toBeNull();
    expect(
      unmet(fields, [requirement({ op: 'lte', value: '9.5' })], answer('10'))
    ).toEqual({ fieldId: FIELD, label: 'Szakirány' });
    expect(
      unmet(fields, [requirement({ op: 'equals', value: '10' })], answer(''))
    ).toEqual({ fieldId: FIELD, label: 'Szakirány' });
  });

  it('reads checkboxes as true/false and treats an unanswered box as false', () => {
    const fields = [field({ type: 'checkbox' })];
    expect(
      unmet(fields, [requirement({ op: 'is_true', value: '' })], answer('true'))
    ).toBeNull();
    expect(
      unmet(
        fields,
        [requirement({ op: 'is_false', value: '' })],
        answer('false')
      )
    ).toBeNull();
    expect(
      unmet(fields, [requirement({ op: 'is_false', value: '' })], answer(''))
    ).toBeNull();
    expect(
      unmet(
        fields,
        [requirement({ op: 'is_true', value: '' })],
        answer('false')
      )
    ).toEqual({ fieldId: FIELD, label: 'Szakirány' });
  });

  it('reports the first failing question in the organizer order', () => {
    const second = '44444444-4444-4444-8444-444444444444';
    const fields = [
      field({ label: 'Első' }),
      field({ id: second, label: 'Második' }),
    ];
    const failure = unmet(
      fields,
      [requirement({ value: 'informatika' }), requirement({ fieldId: second })],
      [{ fieldId: FIELD, value: 'matek' }]
    );
    expect(failure).toEqual({ fieldId: FIELD, label: 'Első' });
  });

  it('fails closed on a question the event no longer has', () => {
    expect(unmet([], [requirement()], answer('Informatika'))).toEqual({
      fieldId: FIELD,
      label: FIELD,
    });
  });
});

describe('assertHelperRequirements', () => {
  it('accepts a valid requirement', () => {
    expect(() =>
      assertHelperRequirements([field()], [requirement()])
    ).not.toThrow();
  });

  it('rejects a question that belongs to another event', () => {
    // The id is not in this event's field list, which is what a copied id from
    // another event looks like on write.
    const otherFieldId = '55555555-5555-4555-8555-555555555555';
    expect(() =>
      assertHelperRequirements(
        [field()],
        [requirement({ fieldId: otherFieldId })]
      )
    ).toThrow('not on this event');
  });

  it('rejects a question helpers are not shown', () => {
    expect(() =>
      assertHelperRequirements(
        [field({ audiences: ['guest'] })],
        [requirement()]
      )
    ).toThrow('not shown to helpers');
  });

  it('rejects an operator the field type does not support', () => {
    expect(() =>
      assertHelperRequirements([field()], [requirement({ op: 'gte' })])
    ).toThrow('cannot be used');
  });

  it('rejects a select value that is not one of its options', () => {
    expect(() =>
      assertHelperRequirements(
        [field({ options: ['Informatika'], type: 'select' })],
        [requirement({ value: 'matek' })]
      )
    ).toThrow('one of its options');
  });

  it('rejects a number value that does not parse', () => {
    expect(() =>
      assertHelperRequirements(
        [field({ type: 'number' })],
        [requirement({ value: 'tíz' })]
      )
    ).toThrow('must be a number');
  });

  it('rejects an empty text value', () => {
    expect(() =>
      assertHelperRequirements([field()], [requirement({ value: '  ' })])
    ).toThrow('cannot be empty');
  });
});

describe('helperRequirementRefusalMessage', () => {
  it('names the question', () => {
    expect(helperRequirementRefusalMessage('Szakirány')).toContain(
      '"Szakirány"'
    );
  });
});
