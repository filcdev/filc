import { describe, expect, it } from 'bun:test';
import { diffActivity, valuesEqual } from '#utils/values';

/**
 * The activity diff decides whether a PATCH wrote anything, in events and in
 * every other audited module. These pin the comparisons that keep a resent
 * payload from looking like a change.
 */
describe('valuesEqual', () => {
  it('compares two Dates by instant, not by identity', () => {
    expect(
      valuesEqual(new Date(1_700_000_000_000), new Date(1_700_000_000_000))
    ).toBe(true);
    expect(
      valuesEqual(new Date(1_700_000_000_000), new Date(1_700_000_001_000))
    ).toBe(false);
  });

  it('treats two documents with the same keys in another order as equal', () => {
    // `jsonb` hands object keys back length-then-bytes (`type` before
    // `content`), while zod rebuilds a parsed body in schema order. The
    // literals below cannot show that, because the formatter sorts object
    // keys, so the stored shape is spelled as the JSON the database returns.
    const stored: unknown = JSON.parse(
      '{"type":"paragraph","content":{"text":"hello"}}'
    );
    const parsed = { content: { text: 'hello' }, type: 'paragraph' };

    // Guard the premise: the two really do serialize in different orders.
    expect(JSON.stringify(stored) === JSON.stringify(parsed)).toBe(false);
    expect(valuesEqual(stored, parsed)).toBe(true);
    expect(
      valuesEqual(stored, { content: { text: 'bye' }, type: 'paragraph' })
    ).toBe(false);
  });

  it('keeps array order significant for a column value', () => {
    expect(valuesEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});

describe('diffActivity', () => {
  it('records nothing when the touched values equal the stored ones', () => {
    expect(
      diffActivity({ title: 'Open day' }, { title: 'Open day' }, ['title'])
    ).toBe(null);
  });

  it('never records a key the patch leaves out', () => {
    // Absent (undefined) is "untouched"; `null` is a value the caller set.
    expect(diffActivity({ title: 'Open day' }, {}, ['title'])).toBe(null);
    expect(diffActivity({ maxGrade: 5 }, {}, ['maxGrade'])).toBe(null);
  });

  it('records a value explicitly set to null', () => {
    expect(
      diffActivity({ maxGrade: 5 }, { maxGrade: null }, ['maxGrade'])
    ).toEqual({
      after: { maxGrade: null },
      before: { maxGrade: 5 },
    });
  });

  it('detects a real change', () => {
    expect(
      diffActivity({ title: 'Open day' }, { title: 'Open day!' }, ['title'])
    ).toEqual({ after: { title: 'Open day!' }, before: { title: 'Open day' } });
  });

  it('compares a marked relation list as a set, so a reorder is not a change', () => {
    expect(
      diffActivity({}, {}, [], {
        after: { lessonIds: ['b', 'a'] },
        before: { lessonIds: ['a', 'b'] },
        unordered: ['lessonIds'],
      })
    ).toBe(null);
    expect(
      diffActivity({}, {}, [], {
        after: { lessonIds: ['a', 'b'] },
        before: { lessonIds: ['a'] },
        unordered: ['lessonIds'],
      })
    ).toEqual({
      after: { lessonIds: ['a', 'b'] },
      before: { lessonIds: ['a'] },
    });
  });

  it('keeps an unmarked extras list order-sensitive', () => {
    // Question lists carry their display order, so reordering them is a change.
    expect(
      diffActivity({}, {}, [], {
        after: { fields: ['b', 'a'] },
        before: { fields: ['a', 'b'] },
      })
    ).not.toBe(null);
  });
});
