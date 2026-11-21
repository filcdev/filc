import { describe, expect, it } from 'bun:test';
import {
  categoryDefaults,
  eventCategories,
  eventCategorySchema,
  eventCreateSchema,
  eventUpdateSchema,
} from '@filcdev/api/domains/events/event';

const validCreate = {
  category: 'open_day' as const,
  description: [{ content: 'Come and visit us', type: 'text' }],
  endsAt: new Date('2026-12-01T16:00:00Z'),
  startsAt: new Date('2026-12-01T09:00:00Z'),
  title: 'Open day',
};

describe('categoryDefaults', () => {
  it('has a default for every fixed category', () => {
    for (const category of eventCategories) {
      const defaults = categoryDefaults(category);
      expect(typeof defaults.registrationEnabled).toBe('boolean');
      expect(defaults.audiences.length).toBeGreaterThan(0);
      for (const audience of defaults.audiences) {
        expect(['guest', 'student', 'helper']).toContain(audience);
      }
    }
  });

  it('starts an open day with guest questions and signup on', () => {
    expect(categoryDefaults('open_day')).toEqual({
      audiences: ['guest'],
      registrationEnabled: true,
    });
  });

  it('leaves external programs without signup by default', () => {
    expect(categoryDefaults('external').registrationEnabled).toBe(false);
  });
});

describe('eventCreateSchema', () => {
  it('accepts a valid event', () => {
    expect(eventCreateSchema.safeParse(validCreate).success).toBe(true);
  });

  it('rejects an event that ends before it starts', () => {
    const result = eventCreateSchema.safeParse({
      ...validCreate,
      endsAt: new Date('2026-12-01T08:00:00Z'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a registration window that closes before it opens', () => {
    const result = eventCreateSchema.safeParse({
      ...validCreate,
      registrationClosesAt: new Date('2026-11-01T08:00:00Z'),
      registrationOpensAt: new Date('2026-11-02T08:00:00Z'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a helper window that closes before it opens', () => {
    const result = eventCreateSchema.safeParse({
      ...validCreate,
      helperRegistrationClosesAt: new Date('2026-11-01T08:00:00Z'),
      helperRegistrationOpensAt: new Date('2026-11-02T08:00:00Z'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an inverted grade range', () => {
    const result = eventCreateSchema.safeParse({
      ...validCreate,
      maxGrade: 9,
      minGrade: 11,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(eventCategorySchema.safeParse('concert').success).toBe(false);
  });

  it('accepts a door rule list and rejects an unknown action', () => {
    const rule = {
      action: 'allow' as const,
      id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      message: '',
      show: { email: false, fieldIds: [], name: true },
      when: null,
    };
    expect(
      eventCreateSchema.safeParse({ ...validCreate, checkinRules: [rule] })
        .success
    ).toBe(true);
    expect(
      eventCreateSchema.safeParse({
        ...validCreate,
        checkinRules: [{ ...rule, action: 'maybe' }],
      }).success
    ).toBe(false);
  });
});

describe('eventUpdateSchema', () => {
  it('accepts a single-field patch', () => {
    expect(eventUpdateSchema.safeParse({ title: 'Renamed' }).success).toBe(
      true
    );
  });

  it('rejects reversed dates when the patch carries both', () => {
    const result = eventUpdateSchema.safeParse({
      endsAt: new Date('2026-12-01T08:00:00Z'),
      startsAt: new Date('2026-12-01T09:00:00Z'),
    });
    expect(result.success).toBe(false);
  });

  it('accepts one date alone, leaving the other to the stored row', () => {
    expect(
      eventUpdateSchema.safeParse({
        endsAt: new Date('2026-12-01T08:00:00Z'),
      }).success
    ).toBe(true);
  });

  it('rejects a reversed helper grade range in a patch', () => {
    expect(
      eventUpdateSchema.safeParse({
        helperMaxGrade: 9,
        helperMinGrade: 11,
      }).success
    ).toBe(false);
  });

  it('rejects a reversed helper window in a patch', () => {
    expect(
      eventUpdateSchema.safeParse({
        helperRegistrationClosesAt: new Date('2026-11-01T08:00:00Z'),
        helperRegistrationOpensAt: new Date('2026-11-02T08:00:00Z'),
      }).success
    ).toBe(false);
  });
});
