import { describe, expect, test } from 'bun:test';
import en from './locales/en/notifications.json';
import hu from './locales/hu/notifications.json';

type CopyTree = { readonly [key: string]: string | CopyTree };

/** Every leaf of a locale file as `a.b.c -> copy`. */
function flatten(tree: CopyTree, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      leaves.set(path, value);
      continue;
    }
    for (const [innerPath, innerValue] of flatten(value, path)) {
      leaves.set(innerPath, innerValue);
    }
  }
  return leaves;
}

const enCopy = flatten(en);
const huCopy = flatten(hu);
const enKeys = [...enCopy.keys()].sort();
const huKeys = [...huCopy.keys()].sort();

describe('locale key parity', () => {
  test('en and hu carry the same keys', () => {
    expect(huKeys).toEqual(enKeys);
  });

  test('every value is a non-empty string', () => {
    for (const [key, value] of enCopy) {
      expect(value.trim().length, `en:${key} is empty`).toBeGreaterThan(0);
    }
    for (const [key, value] of huCopy) {
      expect(value.trim().length, `hu:${key} is empty`).toBeGreaterThan(0);
    }
  });

  test('every plural key has both an English one and other form', () => {
    for (const key of enKeys) {
      if (!key.endsWith('_one')) {
        continue;
      }
      const base = key.slice(0, -'_one'.length);
      expect(enKeys, `en:${base} has no _other form`).toContain(
        `${base}_other`
      );
      expect(huKeys, `hu:${base} has no _one form`).toContain(`${base}_one`);
      expect(huKeys, `hu:${base} has no _other form`).toContain(
        `${base}_other`
      );
    }
  });

  test('keys are grouped by owner', () => {
    expect(Object.keys(en).sort()).toEqual([
      'announcement',
      'blogPost',
      'cohortReselection',
      'doorlock',
      'eventTicket',
      'labels',
      'mail',
      'movedLesson',
      'substitution',
      'systemMessage',
      'test',
      'types',
    ]);
    expect(Object.keys(hu).sort()).toEqual(Object.keys(en).sort());
  });
});
