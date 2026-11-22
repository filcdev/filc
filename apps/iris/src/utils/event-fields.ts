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

type Translate = (key: string) => string;

/**
 * One answer as a screen shows it: a checkbox becomes yes or no in the reader's
 * language, never the stored `true`/`false`; everything else is the visitor's
 * own text, or a dash when empty. The CSV/Excel export deliberately keeps the
 * raw value, because there it is data rather than copy.
 */
export function formatEventAnswer(
  type: EventFieldType,
  value: string,
  t: Translate
): string {
  if (type === 'checkbox') {
    if (value === 'true') {
      return t('common.yes');
    }
    if (value === 'false') {
      return t('common.no');
    }
  }
  return value || '—';
}

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
