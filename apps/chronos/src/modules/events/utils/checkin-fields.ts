import type { EventField } from '@filcdev/api/domains/events/fields';
import { badRequest } from '#utils/http';

/**
 * The ids of this event's questions that a door configuration may name. A
 * foreign or unknown id is rejected with a readable 400 rather than stored:
 * the check-in response joins the answers by id, so a stale id would silently
 * vanish from the scanner instead of being an organizer's mistake.
 */
export const assertCheckinFieldIds = (
  fields: readonly EventField[],
  fieldIds: readonly string[]
): void => {
  const known = new Set(fields.map((field) => field.id));
  for (const fieldId of fieldIds) {
    if (!known.has(fieldId)) {
      throw badRequest('A question selected for the door is not on this event');
    }
  }
};

/**
 * Drop the ids a replace no longer keeps. Used for the door's questions inside
 * the transaction that removes them, so no later read can point at a question
 * that is gone.
 */
export const pruneFieldIds = (
  fieldIds: readonly string[],
  kept: ReadonlySet<string>
): string[] => fieldIds.filter((fieldId) => kept.has(fieldId));
