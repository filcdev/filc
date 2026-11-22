import { describe, expect, test } from 'bun:test';
import { strings } from './i18n';

const sourceRoot = import.meta.dir;
const TS_FILE = /\.(ts|tsx)$/;
const PLACEHOLDER = /\{(\w+)\}/g;
const STRING_REFERENCE = /\bs\.([A-Za-z0-9]+)/g;

/** Every `.ts`/`.tsx` file of the scanner, its own test excluded. */
const sourceFiles = [
  ...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: sourceRoot }),
]
  .filter((path) => TS_FILE.test(path) && !path.endsWith('.test.ts'))
  .map((path) => `${sourceRoot}/${path}`);
const sources = await Promise.all(
  sourceFiles.map((path) => Bun.file(path).text())
);
const sourceText = sources.join('\n');

const enKeys = Object.keys(strings.en).sort();
const huKeys = Object.keys(strings.hu).sort();

/** `{name}`-style placeholders a catalogue line expects. */
const placeholders = (value: string): string[] =>
  [...value.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '').sort();

describe('scanner copy', () => {
  test('en and hu carry the same keys', () => {
    expect(huKeys).toEqual(enKeys);
  });

  test('every string is a non-empty string', () => {
    for (const key of enKeys) {
      expect(
        strings.en[key as keyof typeof strings.en].trim().length,
        `en:${key} is empty`
      ).toBeGreaterThan(0);
      expect(
        strings.hu[key as keyof typeof strings.hu].trim().length,
        `hu:${key} is empty`
      ).toBeGreaterThan(0);
    }
  });

  test('every `s.<key>` the screens read exists in both catalogues', () => {
    const used = new Set(
      [...sourceText.matchAll(STRING_REFERENCE)].map((match) => match[1] ?? '')
    );
    const missing = [...used].filter(
      (key) => !(key in strings.en && key in strings.hu)
    );
    expect(missing).toEqual([]);
  });

  test('both languages expect the same placeholders', () => {
    const mismatched: string[] = [];
    for (const key of enKeys) {
      const enValue = strings.en[key as keyof typeof strings.en];
      const huValue = strings.hu[key as keyof typeof strings.hu];
      if (placeholders(enValue).join(',') !== placeholders(huValue).join(',')) {
        mismatched.push(key);
      }
    }
    expect(mismatched).toEqual([]);
  });
});
