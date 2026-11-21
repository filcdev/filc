import { describe, expect, it } from 'bun:test';
import { eventQuestionColumnHeaders } from '@filcdev/api/domains/events/export';
import { csvFile, escapeCsvField, toCsv } from '#utils/csv';

const CSV_FILENAME = /^event-registrations-export-\d{4}-\d{2}-\d{2}\.csv$/;

describe('escapeCsvField', () => {
  it('leaves a plain value alone', () => {
    expect(escapeCsvField('Kiss Anna')).toBe('Kiss Anna');
  });

  it('quotes a value with a comma, a quote or a newline', () => {
    expect(escapeCsvField('Budapest, Váci út')).toBe('"Budapest, Váci út"');
    expect(escapeCsvField('a "quoted" word')).toBe('"a ""quoted"" word"');
    expect(escapeCsvField('two\nlines')).toBe('"two\nlines"');
  });

  it('writes null and undefined as an empty cell', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('keeps Hungarian characters untouched', () => {
    expect(escapeCsvField('Árvíztűrő tükörfúrógép')).toBe(
      'Árvíztűrő tükörfúrógép'
    );
  });
});

describe('toCsv', () => {
  it('writes the header and one row per record, in header order', () => {
    const csv = toCsv(
      ['name', 'email', 'class'],
      [
        { class: '10.a', email: 'anna@example.hu', name: 'Kiss Anna' },
        { class: '', email: 'bela@example.hu', name: 'Nagy Béla' },
      ]
    );

    expect(csv).toBe(
      [
        'name,email,class',
        'Kiss Anna,anna@example.hu,10.a',
        'Nagy Béla,bela@example.hu,',
      ].join('\n')
    );
  });

  it('keeps an embedded comma inside one cell', () => {
    const csv = toCsv(['note'], [{ note: 'vegan, no nuts' }]);
    expect(csv).toBe('note\n"vegan, no nuts"');
  });
});

describe('eventQuestionColumnHeaders', () => {
  it('uses each label once and suffixes a repeat', () => {
    expect(
      eventQuestionColumnHeaders([
        { label: 'Étel' },
        { label: 'Allergia' },
        { label: 'Étel' },
      ])
    ).toEqual(['Étel', 'Allergia', 'Étel (2)']);
  });

  it('suffixes a label that would collide with a fixed column', () => {
    expect(
      eventQuestionColumnHeaders([
        { label: 'name' },
        { label: 'checked_in_at' },
        { label: 'name' },
        { label: 'Étel' },
      ])
    ).toEqual([
      'name (question)',
      'checked_in_at (question)',
      'name (2)',
      'Étel',
    ]);
  });
});

describe('csvFile', () => {
  it('answers a UTF-8 BOM-prefixed CSV file with the composed rows', async () => {
    const file = csvFile(
      'event-registrations',
      ['name', 'note'],
      [{ name: 'Kiss Anna', note: 'gluténmentes' }]
    );

    expect(file.type).toBe('text/csv; charset=utf-8');
    expect(file.name).toMatch(CSV_FILENAME);
    // Excel needs the BOM bytes on disk; `Blob.text()` decodes and strips them.
    expect([...new Uint8Array(await file.arrayBuffer()).slice(0, 3)]).toEqual([
      0xef, 0xbb, 0xbf,
    ]);
    expect(await file.text()).toBe('name,note\nKiss Anna,gluténmentes');
  });
});
