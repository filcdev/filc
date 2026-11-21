import type {
  EventField,
  EventFieldType,
} from '@filcdev/api/domains/events/fields';
import {
  type EventCheckinRule,
  type EventCheckinWhen,
  eventCheckinRuleOpsByType,
  ruleOpHasValue,
} from '@filcdev/api/domains/events/rules';
import { badRequest } from '#utils/http';

/** A plain decimal number: the same shape the answer validator accepts. */
const DECIMAL_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * The comparison key of a free-text answer: trimmed, decomposed, stripped of
 * its diacritics and lowercased. `Ábel` and `abel` are the same visitor typing
 * the same class, so a door rule must not hinge on a keyboard layout.
 */
export const normalizeText = (value: string): string =>
  value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** One conditional rule's question, operator and expected value. */
const assertWhen = (
  byId: ReadonlyMap<string, EventField>,
  rule: EventCheckinRule
): void => {
  const when = rule.when as EventCheckinWhen;
  const field = byId.get(when.fieldId);
  if (!field) {
    throw badRequest('A door rule names a question that is not on this event');
  }
  if (!eventCheckinRuleOpsByType[field.type].includes(when.op)) {
    throw badRequest(`The rule on "${field.label}" cannot use this comparison`);
  }
  if (rule.action === 'deny' && rule.message.trim() === '') {
    throw badRequest(`The deny rule on "${field.label}" needs a message`);
  }
  if (!ruleOpHasValue(when.op)) {
    return;
  }

  const value = when.value.trim();
  if (value === '') {
    throw badRequest(`The rule on "${field.label}" needs a value`);
  }
  if (field.type === 'select' && !(field.options ?? []).includes(when.value)) {
    throw badRequest(
      `The rule on "${field.label}" must name one of its options`
    );
  }
  if (field.type === 'number' && !DECIMAL_NUMBER.test(value)) {
    throw badRequest(`The rule on "${field.label}" must be a number`);
  }
};

/**
 * One rule list is a complete decision procedure: at least one rule, one
 * catch-all, and the catch-all last. The rest of the checks make every rule
 * evaluable — the question is on this event, the operator fits its type, and
 * the expected value is one the question can actually produce. A rule nobody
 * can satisfy would silently lock a door.
 */
export const assertCheckinRules = (
  fields: readonly EventField[],
  rules: readonly EventCheckinRule[]
): void => {
  if (rules.length === 0) {
    throw badRequest('The door needs at least one rule');
  }

  const byId = new Map(fields.map((field) => [field.id, field]));
  const seenIds = new Set<string>();
  let catchAlls = 0;

  rules.forEach((rule, index) => {
    if (seenIds.has(rule.id)) {
      throw badRequest(`The door rule id ${rule.id} appears more than once`);
    }
    seenIds.add(rule.id);

    if (rule.show.fieldIds.some((fieldId) => !byId.has(fieldId))) {
      throw badRequest(
        'A door rule shows a question that is not on this event'
      );
    }

    if (rule.when === null) {
      catchAlls += 1;
      if (index !== rules.length - 1) {
        throw badRequest('The catch-all door rule must be the last one');
      }
      return;
    }

    assertWhen(byId, rule);
  });

  if (catchAlls === 0) {
    throw badRequest('The door needs a catch-all rule');
  }
  if (catchAlls > 1) {
    throw badRequest('The door may only have one catch-all rule');
  }
};

/**
 * Drop what a question replacement removes: a rule whose condition names a
 * deleted question can never match again, and a deleted question cannot be
 * shown. The catch-all is unconditional, so it survives and stays last.
 */
export const pruneCheckinRules = (
  rules: readonly EventCheckinRule[],
  kept: ReadonlySet<string>
): EventCheckinRule[] =>
  rules
    .filter((rule) => rule.when === null || kept.has(rule.when.fieldId))
    .map((rule) => ({
      ...rule,
      show: {
        ...rule.show,
        fieldIds: rule.show.fieldIds.filter((fieldId) => kept.has(fieldId)),
      },
    }));

/** One stored answer as a rule evaluates it. */
export type RuleAnswer = {
  fieldId: string;
  type: EventFieldType;
  value: string;
};

/**
 * Whether one stored answer satisfies one condition. A missing answer fails
 * every value-based operator and passes `is_false`, because an unticked box is
 * exactly what the organizer asked for.
 */
const satisfies = (when: EventCheckinWhen, answer: RuleAnswer | undefined) => {
  const stored = answer?.value ?? '';

  if (when.op === 'is_true') {
    return stored === 'true';
  }
  if (when.op === 'is_false') {
    return stored !== 'true';
  }
  if (when.op === 'contains') {
    return normalizeText(stored).includes(normalizeText(when.value));
  }
  if (when.op === 'equals') {
    if (answer?.type === 'number') {
      return stored.trim() !== '' && Number(stored) === Number(when.value);
    }
    if (answer?.type === 'select') {
      return stored === when.value;
    }
    return normalizeText(stored) === normalizeText(when.value);
  }

  // `gte` / `lte`: a missing or non-numeric answer cannot satisfy a bound.
  if (stored.trim() === '') {
    return false;
  }
  const actual = Number(stored);
  const expected = Number(when.value);
  if (!(Number.isFinite(actual) && Number.isFinite(expected))) {
    return false;
  }
  return when.op === 'gte' ? actual >= expected : actual <= expected;
};

/**
 * The first rule whose condition matches this registration, walking the list in
 * the organizer's order. The catch-all always matches, so a validated list
 * always answers; an unconfigured one answers `null` and the door falls back to
 * allowing entry, because a broken rule must not lock the whole school out.
 */
export const matchCheckinRule = (
  rules: readonly EventCheckinRule[],
  answers: readonly RuleAnswer[]
): EventCheckinRule | null => {
  const answerById = new Map(answers.map((answer) => [answer.fieldId, answer]));

  for (const rule of rules) {
    if (rule.when === null) {
      return rule;
    }
    if (satisfies(rule.when, answerById.get(rule.when.fieldId))) {
      return rule;
    }
  }

  return null;
};
