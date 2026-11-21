import { describe, expect, it } from 'bun:test';
import type { EventField } from '@filcdev/api/domains/events/fields';
import {
  assertCheckinFieldIds,
  pruneFieldIds,
} from '#modules/events/utils/checkin-fields';

const field = (id: string, label: string): EventField => ({
  audiences: ['guest', 'student', 'helper'],
  eventId: '5b4d1f1e-9c3a-4a2e-8b1f-0d2c3b4a5f60',
  id,
  label,
  options: null,
  position: 0,
  required: false,
  type: 'text',
});

const FIELD = field('1a2b3c4d-5e6f-4a7b-9c8d-7e6f5a4b3c2d', 'Szakirány');
const OTHER = field('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', 'Osztály');

describe('assertCheckinFieldIds', () => {
  it('accepts a question of this event', () => {
    expect(() => assertCheckinFieldIds([FIELD], [FIELD.id])).not.toThrow();
  });

  it('accepts an empty list, the default configuration', () => {
    expect(() => assertCheckinFieldIds([FIELD], [])).not.toThrow();
  });

  it('rejects an id that is not on this event with a 400', () => {
    let status: number | undefined;
    try {
      assertCheckinFieldIds([FIELD], [OTHER.id]);
    } catch (error) {
      status = (error as { status?: number }).status;
    }
    expect(status).toBe(400);
  });
});

describe('pruneFieldIds', () => {
  it('keeps the ids the new question set still has', () => {
    expect(pruneFieldIds([FIELD.id, OTHER.id], new Set([FIELD.id]))).toEqual([
      FIELD.id,
    ]);
  });

  it('keeps the configured order', () => {
    expect(
      pruneFieldIds([OTHER.id, FIELD.id], new Set([FIELD.id, OTHER.id]))
    ).toEqual([OTHER.id, FIELD.id]);
  });

  it('empties when every configured question was removed', () => {
    expect(pruneFieldIds([FIELD.id], new Set())).toEqual([]);
  });
});
