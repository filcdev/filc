import { describe, expect, it } from 'bun:test';
import type { EventField } from '@filcdev/api/domains/events/fields';
import { buildExportTable } from '#modules/events/utils/export';

const field = (overrides: Partial<EventField>): EventField => ({
  audiences: ['guest', 'student'],
  eventId: '00000000-0000-4000-8000-000000000001',
  id: '00000000-0000-4000-8000-000000000010',
  label: 'Étel',
  options: null,
  position: 0,
  required: false,
  type: 'text',
  ...overrides,
});

const DIET = field({
  id: '00000000-0000-4000-8000-000000000011',
  label: 'Étel',
  options: ['vegan', 'húsos'],
  position: 0,
  type: 'select',
});
const ALLERGY = field({
  id: '00000000-0000-4000-8000-000000000012',
  label: 'Allergia',
  position: 1,
});
const DUPLICATE = field({
  id: '00000000-0000-4000-8000-000000000013',
  label: 'Étel',
  position: 2,
});

const registration = {
  checkedInAt: new Date('2026-05-05T10:00:00.000Z'),
  cohortName: '10.a',
  createdAt: new Date('2026-05-01T08:00:00.000Z'),
  email: 'kiss.anna@example.hu',
  id: '00000000-0000-4000-8000-0000000000a1',
  name: 'Kiss Anna',
  role: 'participant' as const,
  status: 'confirmed' as const,
};

describe('buildExportTable', () => {
  it('writes the fixed columns then one per question, in position order', () => {
    const { header, rows } = buildExportTable(
      [DIET, ALLERGY, DUPLICATE],
      [registration],
      new Map([
        [
          registration.id,
          new Map([
            [DIET.id, 'vegan'],
            [ALLERGY.id, 'mogyoró'],
          ]),
        ],
      ])
    );

    expect(header).toEqual([
      'name',
      'email',
      'class',
      'role',
      'status',
      'registered_at',
      'checked_in_at',
      'Étel',
      'Allergia',
      'Étel (2)',
    ]);
    expect(rows).toEqual([
      {
        Allergia: 'mogyoró',
        checked_in_at: '2026-05-05T10:00:00.000Z',
        class: '10.a',
        email: 'kiss.anna@example.hu',
        name: 'Kiss Anna',
        registered_at: '2026-05-01T08:00:00.000Z',
        role: 'participant',
        status: 'confirmed',
        Étel: 'vegan',
        'Étel (2)': '',
      },
    ]);
  });

  it('leaves the class and check-in empty for a visitor', () => {
    const { rows } = buildExportTable(
      [DIET],
      [{ ...registration, checkedInAt: null, cohortName: null }],
      new Map()
    );

    expect(rows[0]?.class).toBe('');
    expect(rows[0]?.checked_in_at).toBe('');
    expect(rows[0]).toHaveProperty('Étel', '');
  });

  it('marks a pending helper in the status column', () => {
    const { rows } = buildExportTable(
      [DIET],
      [
        {
          ...registration,
          checkedInAt: null,
          role: 'helper',
          status: 'pending',
        },
      ],
      new Map()
    );

    // The export carries every registration; the status cell is what tells a
    // pending helper apart from a confirmed one.
    expect(rows[0]?.role).toBe('helper');
    expect(rows[0]?.status).toBe('pending');
  });

  it('keeps a fixed cell when a question is labelled like its column', () => {
    const NAME_QUESTION = field({
      id: '00000000-0000-4000-8000-000000000014',
      label: 'name',
    });
    const { header, rows } = buildExportTable(
      [NAME_QUESTION],
      [registration],
      new Map([[registration.id, new Map([[NAME_QUESTION.id, 'Anna']])]])
    );

    expect(header).toContain('name');
    expect(header).toContain('name (question)');
    // Rows key by header: the question cell must not overwrite the fixed one.
    expect(rows[0]?.name).toBe('Kiss Anna');
    expect(rows[0]?.['name (question)']).toBe('Anna');
  });
});
