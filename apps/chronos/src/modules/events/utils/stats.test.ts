import { describe, expect, it } from 'bun:test';
import type { EventField } from '@filcdev/api/domains/events/fields';
import {
  summarizeAnswers,
  summarizeRegistrations,
  takenSeats,
} from '#modules/events/utils/stats';

const field = (overrides: Partial<EventField>): EventField => ({
  appliesTo: 'guest',
  eventId: '00000000-0000-4000-8000-000000000001',
  id: '00000000-0000-4000-8000-000000000010',
  label: 'Question',
  options: null,
  position: 0,
  required: false,
  type: 'text',
  ...overrides,
});

const day = (iso: string) => new Date(iso);

describe('summarizeRegistrations', () => {
  it('counts roles and statuses and keeps the days sparse and ordered', () => {
    const summary = summarizeRegistrations([
      {
        createdAt: day('2026-11-02T10:00:00Z'),
        role: 'participant',
        status: 'confirmed',
      },
      {
        createdAt: day('2026-11-01T09:00:00Z'),
        role: 'visitor',
        status: 'confirmed',
      },
      {
        createdAt: day('2026-11-01T11:00:00Z'),
        role: 'visitor',
        status: 'cancelled',
      },
      {
        createdAt: day('2026-11-01T12:00:00Z'),
        role: 'helper',
        status: 'confirmed',
      },
      {
        createdAt: day('2026-11-02T13:00:00Z'),
        role: 'helper',
        status: 'pending',
      },
    ]);

    expect(summary.byRole).toEqual({ helper: 2, participant: 1, visitor: 2 });
    expect(summary.byStatus).toEqual({
      cancelled: 1,
      confirmed: 3,
      pending: 1,
    });
    expect(summary.perDay).toEqual([
      { count: 3, date: '2026-11-01' },
      { count: 2, date: '2026-11-02' },
    ]);
  });

  it('answers zeroes for an event with no registrations', () => {
    const summary = summarizeRegistrations([]);
    expect(summary.byRole).toEqual({ helper: 0, participant: 0, visitor: 0 });
    expect(summary.byStatus).toEqual({
      cancelled: 0,
      confirmed: 0,
      pending: 0,
    });
    expect(summary.perDay).toEqual([]);
  });

  it('buckets by the school day, not the UTC or host day', () => {
    const rows = [
      {
        createdAt: day('2026-11-01T23:30:00Z'),
        role: 'visitor' as const,
        status: 'confirmed' as const,
      },
      {
        createdAt: day('2026-07-01T22:30:00Z'),
        role: 'participant' as const,
        status: 'confirmed' as const,
      },
    ];

    // Both instants are still the previous evening in UTC, and after midnight
    // in Budapest (CET then CEST), so a host- or UTC-local bucket would file
    // them under 11-01 and 07-01.
    expect(summarizeRegistrations(rows, 'Europe/Budapest').perDay).toEqual([
      { count: 1, date: '2026-07-02' },
      { count: 1, date: '2026-11-02' },
    ]);
    expect(summarizeRegistrations(rows, 'UTC').perDay).toEqual([
      { count: 1, date: '2026-07-01' },
      { count: 1, date: '2026-11-01' },
    ]);
  });
});

describe('summarizeAnswers', () => {
  const SELECT = field({
    id: '00000000-0000-4000-8000-000000000011',
    label: 'Étel',
    options: ['vegan', 'húsos'],
    type: 'select',
  });
  const TEXT = field({
    id: '00000000-0000-4000-8000-000000000012',
    label: 'Allergia',
  });

  it('lists every configured option, zeros included, and totals the answers', () => {
    const summary = summarizeAnswers(
      [SELECT, TEXT],
      [
        { count: 2, fieldId: SELECT.id, value: 'vegan' },
        { count: 1, fieldId: TEXT.id, value: 'mogyoró' },
        { count: 1, fieldId: TEXT.id, value: 'glutén' },
      ]
    );

    expect(summary).toEqual([
      {
        answered: 2,
        fieldId: SELECT.id,
        label: 'Étel',
        options: [
          { count: 2, value: 'vegan' },
          { count: 0, value: 'húsos' },
        ],
        type: 'select',
      },
      {
        answered: 2,
        fieldId: TEXT.id,
        label: 'Allergia',
        options: null,
        type: 'text',
      },
    ]);
  });

  it('answers an unanswered question with a zero and its empty slices', () => {
    const summary = summarizeAnswers([SELECT], []);
    expect(summary[0]?.answered).toBe(0);
    expect(summary[0]?.options).toEqual([
      { count: 0, value: 'vegan' },
      { count: 0, value: 'húsos' },
    ]);
  });
});

describe('takenSeats', () => {
  it('counts confirmed participants and visitors, never helpers or cancels', () => {
    expect(
      takenSeats([
        {
          createdAt: day('2026-11-01T09:00:00Z'),
          role: 'participant',
          status: 'confirmed',
        },
        {
          createdAt: day('2026-11-01T09:00:00Z'),
          role: 'visitor',
          status: 'confirmed',
        },
        {
          createdAt: day('2026-11-01T09:00:00Z'),
          role: 'helper',
          status: 'confirmed',
        },
        {
          createdAt: day('2026-11-01T09:00:00Z'),
          role: 'helper',
          status: 'pending',
        },
        {
          createdAt: day('2026-11-01T09:00:00Z'),
          role: 'participant',
          status: 'cancelled',
        },
      ])
    ).toBe(2);
  });
});
