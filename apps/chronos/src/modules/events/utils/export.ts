import {
  EVENT_EXPORT_COLUMNS,
  eventQuestionColumnHeaders,
} from '@filcdev/api/domains/events/export';
import type { EventField } from '@filcdev/api/domains/events/fields';
import type {
  EventRegistrationRole,
  EventRegistrationStatus,
} from '@filcdev/api/domains/events/registration';

/** One registration row as the export query returns it. */
export type ExportRegistration = {
  checkedInAt: Date | null;
  /** The student's class; null for a visitor, who has no cohort. */
  cohortName: string | null;
  createdAt: Date;
  email: string;
  id: string;
  name: string;
  role: EventRegistrationRole;
  status: EventRegistrationStatus;
};

/**
 * The CSV table of one event's registrations: the fixed columns, then one per
 * question in the event's position order, cells keyed by their header. Kept
 * pure — the handler reads, this shapes — so the column order and the question
 * cells are testable without a database.
 */
export const buildExportTable = (
  fields: readonly EventField[],
  registrations: readonly ExportRegistration[],
  answers: ReadonlyMap<string, ReadonlyMap<string, string>>
): { header: string[]; rows: Record<string, unknown>[] } => {
  const questionHeaders = eventQuestionColumnHeaders(fields);
  const header = [...EVENT_EXPORT_COLUMNS, ...questionHeaders];

  const rows = registrations.map((registration) => {
    const byField = answers.get(registration.id);
    const record: Record<string, unknown> = {
      checked_in_at: registration.checkedInAt?.toISOString() ?? '',
      class: registration.cohortName ?? '',
      email: registration.email,
      name: registration.name,
      registered_at: registration.createdAt.toISOString(),
      role: registration.role,
      status: registration.status,
    };
    fields.forEach((field, index) => {
      record[questionHeaders[index]] = byField?.get(field.id) ?? '';
    });
    return record;
  });

  return { header, rows };
};
