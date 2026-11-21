import { describe, expect, it } from 'bun:test';
import type { EventField } from '@filcdev/api/domains/events/fields';
import type { EventCheckinRule } from '@filcdev/api/domains/events/rules';
import {
  assertCheckinRules,
  matchCheckinRule,
  pruneCheckinRules,
} from '#modules/events/utils/door-rules';

const EVENT_ID = '5b4d1f1e-9c3a-4a2e-8b1f-0d2c3b4a5f60';
const CLASS_ID = '1a2b3c4d-5e6f-4a7b-9c8d-7e6f5a4b3c2d';
const AGE_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const KIND_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';
const FOREIGN_ID = '7a8b9c0d-1e2f-4a3b-9c4d-5e6f7a8b9c0d';

const RULE_1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const RULE_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const CATCH_ALL = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

const field = (
  id: string,
  label: string,
  type: EventField['type'],
  options: string[] | null = null
): EventField => ({
  audiences: ['guest'],
  eventId: EVENT_ID,
  id,
  label,
  options,
  position: 0,
  required: false,
  type,
});

const FIELDS = [
  field(CLASS_ID, 'Osztály', 'select', ['10.B', '11.A']),
  field(AGE_ID, 'Kor', 'number'),
  field(KIND_ID, 'Napijegy', 'checkbox'),
];

const show = { email: false, fieldIds: [], name: true };

const allow = (
  overrides: Partial<EventCheckinRule> = {}
): EventCheckinRule => ({
  action: 'allow',
  id: RULE_1,
  message: '',
  show,
  when: null,
  ...overrides,
});

const deny = (overrides: Partial<EventCheckinRule> = {}): EventCheckinRule => ({
  action: 'deny',
  id: RULE_1,
  message: 'Nem jogosult',
  show,
  when: { fieldId: CLASS_ID, op: 'equals', value: '10.B' },
  ...overrides,
});

describe('assertCheckinRules', () => {
  it('accepts a conditional rule followed by the catch-all', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [deny(), allow({ id: CATCH_ALL })])
    ).not.toThrow();
  });

  it('rejects an empty rule list', () => {
    expect(() => assertCheckinRules(FIELDS, [])).toThrow();
  });

  it('rejects a missing catch-all', () => {
    expect(() => assertCheckinRules(FIELDS, [deny()])).toThrow();
  });

  it('rejects a second catch-all', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        deny(),
        allow({ id: RULE_2 }),
        allow({ id: CATCH_ALL }),
      ])
    ).toThrow();
  });

  it('rejects a catch-all that is not last', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [allow({ id: CATCH_ALL }), deny()])
    ).toThrow();
  });

  it('rejects a rule naming another event’s question', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        deny({ when: { fieldId: FOREIGN_ID, op: 'equals', value: '10.B' } }),
        allow({ id: CATCH_ALL }),
      ])
    ).toThrow();
  });

  it('rejects an operator that does not fit the question type', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        deny({ when: { fieldId: AGE_ID, op: 'contains', value: '16' } }),
        allow({ id: CATCH_ALL }),
      ])
    ).toThrow();
  });

  it('rejects a select value that is not one of its options', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        deny({ when: { fieldId: CLASS_ID, op: 'equals', value: '12.C' } }),
        allow({ id: CATCH_ALL }),
      ])
    ).toThrow();
  });

  it('rejects a number condition whose value does not parse', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        deny({ when: { fieldId: AGE_ID, op: 'gte', value: 'eighteen' } }),
        allow({ id: CATCH_ALL }),
      ])
    ).toThrow();
  });

  it('rejects a deny rule without a message', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        deny({ message: ' ' }),
        allow({ id: CATCH_ALL }),
      ])
    ).toThrow();
  });

  it('rejects a show list naming another event’s question', () => {
    expect(() =>
      assertCheckinRules(FIELDS, [
        allow({
          id: CATCH_ALL,
          show: { email: false, fieldIds: [FOREIGN_ID], name: true },
        }),
      ])
    ).toThrow();
  });
});

describe('pruneCheckinRules', () => {
  it('drops a rule whose question was removed and keeps the catch-all', () => {
    const rules = [deny(), allow({ id: CATCH_ALL })];
    expect(pruneCheckinRules(rules, new Set([AGE_ID]))).toEqual([
      allow({ id: CATCH_ALL }),
    ]);
  });

  it('removes a deleted question from a rule’s show list', () => {
    const rules = [
      allow({
        id: CATCH_ALL,
        show: { email: false, fieldIds: [CLASS_ID, AGE_ID], name: false },
      }),
    ];
    expect(pruneCheckinRules(rules, new Set([AGE_ID]))).toEqual([
      allow({
        id: CATCH_ALL,
        show: { email: false, fieldIds: [AGE_ID], name: false },
      }),
    ]);
  });
});

describe('matchCheckinRule', () => {
  const answers = [
    { fieldId: CLASS_ID, type: 'select' as const, value: '10.B' },
  ];

  it('returns the first matching rule', () => {
    const rules = [
      deny({ when: { fieldId: CLASS_ID, op: 'equals', value: '10.B' } }),
      allow({ id: RULE_2 }),
      allow({ id: CATCH_ALL }),
    ];
    expect(matchCheckinRule(rules, answers)?.id).toBe(RULE_1);
  });

  it('falls back to the catch-all when nothing matches', () => {
    const rules = [
      deny({ when: { fieldId: CLASS_ID, op: 'equals', value: '11.A' } }),
      allow({ id: CATCH_ALL }),
    ];
    expect(matchCheckinRule(rules, answers)?.id).toBe(CATCH_ALL);
  });

  it('returns null for an unconfigured event', () => {
    expect(matchCheckinRule([], answers)).toBe(null);
  });
});
