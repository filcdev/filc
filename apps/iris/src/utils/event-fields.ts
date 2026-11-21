import {
  defaultEventFieldAudiences,
  type EventFieldAudience,
  type EventFieldType,
} from '@filcdev/api/domains/events/fields';

/** One custom question while the organizer edits it, before it is sent. */
export type EventFieldDraft = {
  audiences: EventFieldAudience[];
  id?: string;
  key: string;
  label: string;
  optionsText: string;
  required: boolean;
  type: EventFieldType;
};

/**
 * A blank question row. It starts on every audience — guest, student and
 * helper — so no category and no default can hide it from a form the
 * organizer is looking at; narrowing it is an explicit tick.
 */
export function newEventFieldDraft(): EventFieldDraft {
  return {
    audiences: [...defaultEventFieldAudiences],
    key: crypto.randomUUID(),
    label: '',
    optionsText: '',
    required: false,
    type: 'text',
  };
}
