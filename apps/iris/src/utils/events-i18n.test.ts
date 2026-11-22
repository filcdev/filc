import { describe, expect, test } from 'bun:test';
import {
  eventCategories,
  eventEligibilityReasons,
  eventStatuses,
} from '@filcdev/api/domains/events/event';
import {
  eventFieldAudiences,
  eventFieldTypes,
} from '@filcdev/api/domains/events/fields';
import {
  eventRegistrationRoles,
  eventRegistrationStatuses,
} from '@filcdev/api/domains/events/registration';
import {
  eventCheckinRuleActions,
  eventCheckinRuleOps,
} from '@filcdev/api/domains/events/rules';
import en from '../../public/locales/en/translation.json';
import hu from '../../public/locales/hu/translation.json';
import { eventRegistrationStates } from './event-registration-state';

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
const enKeys = new Set(enCopy.keys());
const huKeys = new Set(huCopy.keys());

const sourceRoot = `${import.meta.dir}/..`;
const TS_FILE = /\.(ts|tsx)$/;
const EVENTS_FILE = /event|tickets/;
const STATIC_T = /\bt\(\s*(['"])([^'"]+)\1/g;
const EVENTS_LITERAL = /(['"])(events\.[A-Za-z0-9_.]+)\1/g;
const DYNAMIC_T = /\bt\(\s*`([^`]*)\$\{/g;
const COUNT_T = /\bt\(\s*'([^']+)'/g;
const COUNT_OPTION = /\bcount\s*:/;

/**
 * Every file of the events feature and its ticket page, as source text. The
 * path is read relative to `src`: the repository directory contains "event"
 * too, which would otherwise match every file.
 */
const sourceFiles = [
  ...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: sourceRoot }),
]
  .filter(
    (path) =>
      TS_FILE.test(path) && !path.includes('.test.') && EVENTS_FILE.test(path)
  )
  .map((path) => `${sourceRoot}/${path}`);
const sources = await Promise.all(
  sourceFiles.map((path) => Bun.file(path).text())
);

/** A static key passed to `t(...)`, plus any `events.*` literal in the file. */
const staticKeys = new Set<string>();
for (const source of sources) {
  for (const match of source.matchAll(STATIC_T)) {
    staticKeys.add(match[2] ?? '');
  }
  for (const match of source.matchAll(EVENTS_LITERAL)) {
    staticKeys.add(match[2] ?? '');
  }
}
staticKeys.delete('');

/** A template key such as `` t(`events.audiences.${audience}`) ``. */
const dynamicPrefixes = new Set(
  sources.flatMap((source) =>
    [...source.matchAll(DYNAMIC_T)].map((match) => match[1] ?? '')
  )
);

/**
 * The enum behind each dynamic family. A new value (a category, an ops word)
 * must land in both catalogues before this test passes again.
 */
const families: [string, readonly string[]][] = [
  ['events.audiences.', eventFieldAudiences],
  ['events.categories.', eventCategories],
  ['events.checkinRules.actions.', eventCheckinRuleActions],
  ['events.checkinRules.ops.', eventCheckinRuleOps],
  ['events.fieldTypes.', eventFieldTypes],
  ['events.participants.roles.', eventRegistrationRoles],
  ['events.participants.statuses.', eventRegistrationStatuses],
  ['events.public.reasons.', eventEligibilityReasons],
  ['events.public.registration.status.', eventRegistrationStates],
  ['events.statuses.', eventStatuses],
];

/** The end of a quoted string, so a `(` inside copy cannot unbalance a call. */
function quoteEnd(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
    } else if (source[index] === quote) {
      return index;
    }
  }
  return source.length;
}

/** The text of one call, from its opening to its matching closing paren. */
function callText(source: string, open: number): string {
  let depth = 0;
  let index = open;
  while (index < source.length) {
    const character = source[index];
    if (character === "'" || character === '"' || character === '`') {
      index = quoteEnd(source, index) + 1;
      continue;
    }
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, index + 1);
      }
    }
    index += 1;
  }
  return '';
}

/**
 * The keys a `count` makes i18next look up as `_one`/`_other`. The options can
 * contain a nested `t()`, so the call's matching paren decides where it ends.
 */
const countKeys = new Set<string>();
for (const source of sources) {
  for (const match of source.matchAll(COUNT_T)) {
    const open = source.indexOf('(', match.index ?? 0);
    if (open !== -1 && COUNT_OPTION.test(callText(source, open))) {
      countKeys.add(match[1] ?? '');
    }
  }
}
countKeys.delete('');

describe('events locale keys', () => {
  test('en and hu carry the same events keys', () => {
    const eventsEn = [...enKeys].filter((key) => key.startsWith('events.'));
    const eventsHu = [...huKeys].filter((key) => key.startsWith('events.'));
    expect(eventsHu.sort()).toEqual(eventsEn.sort());
  });

  test('every key the events surfaces reference exists in both locales', () => {
    const missing: string[] = [];
    for (const key of staticKeys) {
      // A `count` key is resolved through its plural suffixes, checked below.
      if (countKeys.has(key)) {
        continue;
      }
      if (!enKeys.has(key)) {
        missing.push(`en:${key}`);
      }
      if (!huKeys.has(key)) {
        missing.push(`hu:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('every dynamic family is translated for every enum value', () => {
    const missing: string[] = [];
    for (const [prefix, values] of families) {
      for (const value of values) {
        const key = `${prefix}${value}`;
        if (!enKeys.has(key)) {
          missing.push(`en:${key}`);
        }
        if (!huKeys.has(key)) {
          missing.push(`hu:${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('every dynamic template calls a family that exists in both locales', () => {
    const missing: string[] = [];
    for (const prefix of dynamicPrefixes) {
      const inEn = [...enKeys].filter((key) => key.startsWith(prefix));
      const inHu = [...huKeys].filter((key) => key.startsWith(prefix));
      if (inEn.length === 0) {
        missing.push(`en:${prefix}*`);
      }
      if (inHu.length !== inEn.length) {
        missing.push(`hu:${prefix}*`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('count keys carry the plural forms i18next expects', () => {
    expect(countKeys.size).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const key of countKeys) {
      for (const suffix of ['_one', '_other']) {
        if (!enKeys.has(`${key}${suffix}`)) {
          missing.push(`en:${key}${suffix}`);
        }
        if (!huKeys.has(`${key}${suffix}`)) {
          missing.push(`hu:${key}${suffix}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test('no events copy is empty', () => {
    for (const [key, value] of enCopy) {
      if (key.startsWith('events.')) {
        expect(value.trim().length, `en:${key} is empty`).toBeGreaterThan(0);
      }
    }
    for (const [key, value] of huCopy) {
      if (key.startsWith('events.')) {
        expect(value.trim().length, `hu:${key} is empty`).toBeGreaterThan(0);
      }
    }
  });
});
