import type { EventHelperRequirement } from '@filcdev/api/domains/events/event';
import type { EventField } from '@filcdev/api/domains/events/fields';
import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';
import { normaliseHelperText } from '#modules/events/utils/helper-requirements';

/** The first condition an application does not satisfy, and its question. */
export type HelperRequirementFailure = {
  fieldId: string;
  label: string;
};

/** A plain decimal number, matching what the signup form accepts. */
const DECIMAL_NUMBER = /^-?\d+(?:\.\d+)?$/;

const numberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  return DECIMAL_NUMBER.test(trimmed) ? Number(trimmed) : null;
};

/** The applicant's answer to one question, or the empty answer they left. */
const answerOf = (
  answers: readonly EventRegistrationAnswer[],
  fieldId: string
): string => answers.find((answer) => answer.fieldId === fieldId)?.value ?? '';

/**
 * Whether one answer satisfies one condition.
 *
 * Text and select comparisons use `normaliseHelperText`, so case and accents
 * do not decide a helper's eligibility; `contains` is a substring of the same
 * normalised form. Numbers compare numerically, and a checkbox compares its
 * stored `true`/`false` (an unanswered box is false). A value the type cannot
 * read never matches.
 */
const matches = (
  field: EventField,
  requirement: EventHelperRequirement,
  answer: string
): boolean => {
  switch (field.type) {
    case 'checkbox':
      return requirement.op === 'is_true'
        ? answer.trim() === 'true'
        : answer.trim() !== 'true';
    case 'number': {
      const actual = numberOrNull(answer);
      const expected = numberOrNull(requirement.value);
      if (actual === null || expected === null) {
        return false;
      }
      if (requirement.op === 'equals') {
        return actual === expected;
      }
      return requirement.op === 'gte' ? actual >= expected : actual <= expected;
    }
    case 'select':
      return (
        normaliseHelperText(answer) === normaliseHelperText(requirement.value)
      );
    case 'text':
    case 'textarea': {
      const actual = normaliseHelperText(answer);
      const expected = normaliseHelperText(requirement.value);
      return requirement.op === 'equals'
        ? actual === expected
        : actual.includes(expected);
    }
    default:
      return false;
  }
};

/**
 * The first requirement the application's answers do not satisfy, in the
 * organizer's order, or null when every one is met. A condition naming a
 * question this event no longer has fails closed rather than silently
 * admitting the applicant.
 */
export const firstUnmetHelperRequirement = (
  fields: readonly EventField[],
  requirements: readonly EventHelperRequirement[],
  answers: readonly EventRegistrationAnswer[]
): HelperRequirementFailure | null => {
  const byId = new Map(fields.map((field) => [field.id, field]));

  for (const requirement of requirements) {
    const field = byId.get(requirement.fieldId);
    if (!field) {
      return { fieldId: requirement.fieldId, label: requirement.fieldId };
    }
    if (!matches(field, requirement, answerOf(answers, requirement.fieldId))) {
      return { fieldId: field.id, label: field.label };
    }
  }

  return null;
};

/** What a refused helper application says, naming the question to answer. */
export const helperRequirementRefusalMessage = (label: string): string =>
  `Your answer to "${label}" does not meet this event's helper requirements`;
