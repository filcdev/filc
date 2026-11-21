import type {
  EventFieldAppliesTo,
  EventFieldType,
} from '@filcdev/api/domains/events/fields';

/** One custom question while the organizer edits it, before it is sent. */
export type EventFieldDraft = {
  appliesTo: EventFieldAppliesTo;
  id?: string;
  key: string;
  label: string;
  optionsText: string;
  required: boolean;
  type: EventFieldType;
};

/**
 * A blank question row. It starts on `both` whatever the event category is:
 * the category used to seed it, and an open-day event seeded `guest`, which
 * kept the question off the student form the organizer was looking at.
 */
export function newEventFieldDraft(): EventFieldDraft {
  return {
    appliesTo: 'both',
    key: crypto.randomUUID(),
    label: '',
    optionsText: '',
    required: false,
    type: 'text',
  };
}
