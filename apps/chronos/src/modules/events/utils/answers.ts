import type { EventField } from '@filcdev/api/domains/events/fields';
import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';

export type AnswersCheck =
  | { ok: true; answers: EventRegistrationAnswer[] }
  | { ok: false; message: string };

/** A plain decimal number: no `0x`, no exponent, no empty string. */
const DECIMAL_NUMBER = /^-?\d+(?:\.\d+)?$/;

/** What is wrong with one answer, or null when it is acceptable. */
const answerProblem = (field: EventField, value: string): string | null => {
  if (field.required && value === '') {
    return `"${field.label}" is required`;
  }
  // A checkbox answers `true`/`false`; "required" means it has to be ticked,
  // because an unticked box still sends a value and would otherwise pass.
  if (field.type === 'checkbox' && field.required && value !== 'true') {
    return `"${field.label}" is required`;
  }
  // An empty choice is how a dropdown is cleared. A required one never gets
  // here empty: the check above already named it.
  if (
    field.type === 'select' &&
    value !== '' &&
    !(field.options ?? []).includes(value)
  ) {
    return `"${field.label}" must be one of its options`;
  }
  // `Number('')` is 0 and `Number('0x10')` is 16, so the shape is checked
  // instead of the coercion.
  if (field.type === 'number' && value !== '' && !DECIMAL_NUMBER.test(value)) {
    return `"${field.label}" must be a number`;
  }
  return null;
};

/**
 * The answers of one registration, checked against the event's student
 * questions: each answer names one of them, a question is answered once, a
 * choice is one of its options, a number parses, and every required question is
 * filled in. Guest-only questions are not part of this form and are rejected.
 *
 * Values are stored trimmed, so what a form shows on the way back in is what
 * the visitor meant to type.
 */
export const checkAnswers = (
  fields: readonly EventField[],
  answers: readonly EventRegistrationAnswer[]
): AnswersCheck => {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const seen = new Set<string>();

  for (const answer of answers) {
    const field = byId.get(answer.fieldId);
    if (!field) {
      return { message: 'That question is not on this signup form', ok: false };
    }
    if (seen.has(answer.fieldId)) {
      return { message: 'Each question can be answered once', ok: false };
    }
    seen.add(answer.fieldId);

    const problem = answerProblem(field, answer.value.trim());
    if (problem) {
      return { message: problem, ok: false };
    }
  }

  const missing = fields.find((field) => field.required && !seen.has(field.id));
  if (missing) {
    return { message: `"${missing.label}" is required`, ok: false };
  }

  return {
    answers: answers.map((answer) => ({
      fieldId: answer.fieldId,
      value: answer.value.trim(),
    })),
    ok: true,
  };
};
