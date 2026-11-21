import {
  type EventHelperRequirement,
  helperRequirementOpsByFieldType,
} from '@filcdev/api/domains/events/event';
import type { EventField } from '@filcdev/api/domains/events/fields';
import { badRequest } from '#utils/http';

/** A plain decimal number: no `0x`, no exponent, no empty string. */
const DECIMAL_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * The comparison form of an answer or a configured value: trimmed, lowercased
 * and stripped of diacritics, so `"Informatika"`, `"informatika"` and
 * `"INFORMATIKA"` are one value, and `"Környezetvédelem"` matches
 * `"kornyezetvedelem"`. `NFD` splits a letter from its accent, and
 * `\p{Diacritic}` removes the accent marks; the base letters stay.
 */
export const normaliseHelperText = (value: string): string =>
  value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** The event's question a requirement names, or a readable 400. */
const requirementField = (
  byId: ReadonlyMap<string, EventField>,
  requirement: EventHelperRequirement
): EventField => {
  const field = byId.get(requirement.fieldId);
  if (!field) {
    throw badRequest(
      'A helper requirement refers to a question that is not on this event'
    );
  }
  if (!field.audiences.includes('helper')) {
    throw badRequest(
      `The helper requirement question "${field.label}" is not shown to helpers`
    );
  }
  return field;
};

/** The value a requirement needs for its operator and the field's type. */
const requirementValue = (
  field: EventField,
  requirement: EventHelperRequirement
): void => {
  const allowed = helperRequirementOpsByFieldType[field.type];
  if (!allowed.includes(requirement.op)) {
    throw badRequest(
      `The "${requirement.op}" operator cannot be used on the "${field.label}" question`
    );
  }

  if (field.type === 'select') {
    if (!(field.options ?? []).includes(requirement.value)) {
      throw badRequest(
        `The value for "${field.label}" must be one of its options`
      );
    }
    return;
  }

  if (field.type === 'number') {
    if (!DECIMAL_NUMBER.test(requirement.value.trim())) {
      throw badRequest(`The value for "${field.label}" must be a number`);
    }
    return;
  }

  if (
    (field.type === 'text' || field.type === 'textarea') &&
    requirement.value.trim() === ''
  ) {
    throw badRequest(`The value for "${field.label}" cannot be empty`);
  }
};

/**
 * Checks a requirements list against the event's own questions before it is
 * stored. Throws a readable 400 for the first problem, rather than storing a
 * condition that can never be answered or matched.
 *
 * The field has to belong to this event (a copied id from another event is
 * rejected here, which is also what keeps the picker honest), be shown to
 * helpers, accept the chosen operator, and carry a value the field's type can
 * actually match.
 */
export const assertHelperRequirements = (
  fields: readonly EventField[],
  requirements: readonly EventHelperRequirement[]
): void => {
  const byId = new Map(fields.map((field) => [field.id, field]));

  for (const requirement of requirements) {
    const field = requirementField(byId, requirement);
    requirementValue(field, requirement);
  }
};
