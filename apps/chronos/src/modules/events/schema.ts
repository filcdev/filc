import {
  type EventCategory,
  type EventCheckinDisplay,
  type EventStatus,
  eventCategories,
  eventCheckinDisplays,
  eventStatuses,
} from '@filcdev/api/domains/events/event';
import {
  defaultEventFieldAudiences,
  type EventFieldAudience,
  type EventFieldType,
  eventFieldAudiences,
  eventFieldTypes,
} from '@filcdev/api/domains/events/fields';
import {
  type EventRegistrationRole,
  type EventRegistrationStatus,
  eventRegistrationRoles,
  eventRegistrationStatuses,
} from '@filcdev/api/domains/events/registration';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { JSONType } from 'zod';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';

/**
 * The quoted literals of a SQL `IN (...)`, rendered from a compile-time union
 * so a CHECK cannot drift from the wire schema. Values are constants, never
 * caller input, so `sql.raw` is safe here — parameters are not allowed in DDL.
 */
const sqlLiterals = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(', '));

/**
 * Phase A owns the organizer's side only: the event, its cohort targeting and
 * its signup questions. Registrations (phase B) and their tickets (phase C)
 * add their own tables together with the code that writes them.
 */
export const event = pgTable(
  'event',
  {
    /** Null means unlimited seats. */
    capacity: integer('capacity'),
    category: text('category').$type<EventCategory>().notNull(),
    /**
     * What the door's scanner reveals on a check-in: `minimal` nothing about
     * the person, `name` the visitor/ticket holder, `full` name and address.
     * Read by the check-in handler on every scan, never filtered client-side.
     */
    checkinDisplay: text('checkin_display')
      .$type<EventCheckinDisplay>()
      .notNull()
      .default('name'),
    /**
     * The questions whose answers the door returns, in this order. A JSONB list
     * of ids rather than a child table: it is read and replaced with the event
     * row, and every id is kept inside this event by the write validator.
     */
    checkinFields: jsonb('checkin_fields')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    // Registration scope, not visibility: every published event is visible to
    // everyone, and only a student whose cohort is listed here may sign up. An
    // empty list means every student may. Ids are validated on write, and a
    // cohort removed later simply stops matching.
    cohortIds: text('cohort_ids').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamps.createdAt,
    /** Null once the author's account is gone; the event stays. */
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    /** The rich-text payload the announcement editor writes. */
    description: jsonb('description').$type<JSONType>().notNull(),
    endsAt: timestamp('ends_at').notNull(),
    /**
     * Whether a visitor (a parent) may sign up without an account. Its own
     * switch on purpose: guest questions on the form do not turn guest signup
     * on, and turning it on does not add questions.
     */
    guestRegistrationEnabled: boolean('guest_registration_enabled')
      .notNull()
      .default(false),
    /** Students may sign up as helpers only while this switch is on. */
    helperRegistrationEnabled: boolean('helper_registration_enabled')
      .notNull()
      .default(false),
    /**
     * When on, helpers use their own window below. When off, that window is
     * ignored and they share `registrationOpensAt`/`registrationClosesAt`.
     */
    helperRegistrationSeparateWindow: boolean(
      'helper_registration_separate_window'
    )
      .notNull()
      .default(false),
    helperRegistrationClosesAt: timestamp('helper_registration_closes_at'),
    helperRegistrationOpensAt: timestamp('helper_registration_opens_at'),
    id: uuid('id').primaryKey().defaultRandom(),
    /** Bytes of the stored banner; the object itself lives in S3. */
    imageByteSize: integer('image_byte_size'),
    imageContentType: text('image_content_type'),
    /** S3 object key; also the flag that a banner exists. */
    imageKey: text('image_key'),
    /** Bumped on every upload; the browser's cache-busting token. */
    imageUpdatedAt: timestamp('image_updated_at'),
    /**
     * The grade band helpers sign up in. Either bound governs helpers when
     * set; with both null the event's own bounds below apply to them too.
     */
    helperMaxGrade: integer('helper_max_grade'),
    helperMinGrade: integer('helper_min_grade'),
    /** Null means no upper/lower grade bound. */
    maxGrade: integer('max_grade'),
    minGrade: integer('min_grade'),
    registrationClosesAt: timestamp('registration_closes_at'),
    registrationEnabled: boolean('registration_enabled')
      .notNull()
      .default(true),
    registrationOpensAt: timestamp('registration_opens_at'),
    startsAt: timestamp('starts_at').notNull(),
    status: text('status').$type<EventStatus>().notNull().default('draft'),
    title: text('title').notNull(),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    index('event_status_starts_at_idx').on(t.status, t.startsAt),
    index('event_registration_opens_at_idx').on(t.registrationOpensAt),
    check(
      'event_category_valid',
      sql`${t.category} IN (${sqlLiterals(eventCategories)})`
    ),
    check(
      'event_checkin_display_valid',
      sql`${t.checkinDisplay} IN (${sqlLiterals(eventCheckinDisplays)})`
    ),
    check(
      'event_status_valid',
      sql`${t.status} IN (${sqlLiterals(eventStatuses)})`
    ),
    check('event_dates_ordered', sql`${t.endsAt} >= ${t.startsAt}`),
    // Same rule the handler enforces, so a half-written window cannot exist.
    check(
      'event_registration_window_ordered',
      sql`(${t.registrationOpensAt} IS NULL OR ${t.registrationClosesAt} IS NULL
        OR ${t.registrationClosesAt} >= ${t.registrationOpensAt})`
    ),
    // The helper window is a second pair with the same rule; which one applies
    // is decided by `helper_registration_separate_window`, not by the columns.
    check(
      'event_helper_registration_window_ordered',
      sql`(${t.helperRegistrationOpensAt} IS NULL
        OR ${t.helperRegistrationClosesAt} IS NULL
        OR ${t.helperRegistrationClosesAt} >= ${t.helperRegistrationOpensAt})`
    ),
    check(
      'event_grade_range',
      sql`(${t.minGrade} IS NULL OR ${t.maxGrade} IS NULL
        OR ${t.minGrade} <= ${t.maxGrade})`
    ),
    // The school runs grades 1-13, and the helper band has to be a real one.
    check(
      'event_helper_grades_valid',
      sql`(${t.helperMinGrade} IS NULL
          OR (${t.helperMinGrade} >= 1 AND ${t.helperMinGrade} <= 13))
        AND (${t.helperMaxGrade} IS NULL
          OR (${t.helperMaxGrade} >= 1 AND ${t.helperMaxGrade} <= 13))`
    ),
    check(
      'event_helper_grade_range',
      sql`(${t.helperMinGrade} IS NULL OR ${t.helperMaxGrade} IS NULL
        OR ${t.helperMinGrade} <= ${t.helperMaxGrade})`
    ),
    // The four image columns describe one object, so a half-written row must
    // be impossible. Same rule as the announcement table.
    check(
      'event_image_complete',
      sql`(${t.imageKey} IS NULL) = (${t.imageContentType} IS NULL)
        AND (${t.imageKey} IS NULL) = (${t.imageByteSize} IS NULL)
        AND (${t.imageKey} IS NULL) = (${t.imageUpdatedAt} IS NULL)`
    ),
  ]
);

/** The per-event signup question set. */
export const eventField = pgTable(
  'event_field',
  {
    /**
     * Whose signup form shows the question. A set, not one choice: the old
     * `both` is `{guest,student}`, and helpers are an audience of their own.
     */
    audiences: text('audiences')
      .array()
      .$type<EventFieldAudience[]>()
      .notNull()
      .default(sql.raw(`'{${defaultEventFieldAudiences.join(',')}}'`)),
    eventId: uuid('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    label: text('label').notNull(),
    /** Select options; null for every other type. */
    options: text('options').array(),
    position: integer('position').notNull().default(0),
    required: boolean('required').notNull().default(false),
    type: text('type').$type<EventFieldType>().notNull(),
  },
  (t) => [
    // The question list is always read by event; without this index every
    // detail read scans the whole table.
    index('event_field_event_id_idx').on(t.eventId),
    check(
      'event_field_type_valid',
      sql`${t.type} IN (${sqlLiterals(eventFieldTypes)})`
    ),
    // Every element is a known audience and each appears once. The sum trick
    // is what expresses "no duplicates" without a subquery: each audience
    // contributes at most one to the count.
    check(
      'event_field_audiences_valid',
      sql`${t.audiences} <@ ${sql.raw(`ARRAY[${eventFieldAudiences.map((audience) => `'${audience}'`).join(', ')}]::text[]`)}
        AND cardinality(${t.audiences}) > 0
        AND cardinality(${t.audiences}) = (
          (CASE WHEN 'guest' = ANY(${t.audiences}) THEN 1 ELSE 0 END)
          + (CASE WHEN 'student' = ANY(${t.audiences}) THEN 1 ELSE 0 END)
          + (CASE WHEN 'helper' = ANY(${t.audiences}) THEN 1 ELSE 0 END)
        )`
    ),
  ]
);

/**
 * One student's place on an event. A cancelled row is kept, never deleted: it
 * remembers the answers and is reactivated when the student registers again, so
 * the unique `(event_id, user_id)` pair holds without a special case.
 */
export const eventRegistration = pgTable(
  'event_registration',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    /** The visitor's address: the ticket goes here, and it is the guest's identity. */
    guestEmail: text('guest_email'),
    /** The visitor's own name; null for a signed-in student. */
    guestName: text('guest_name'),
    id: uuid('id').primaryKey().defaultRandom(),
    /** Visitors take a seat; only helpers are exempt. */
    role: text('role')
      .$type<EventRegistrationRole>()
      .notNull()
      .default('participant'),
    status: text('status')
      .$type<EventRegistrationStatus>()
      .notNull()
      .default('confirmed'),
    /** Null for a visitor: they have no account, which is the point of guests. */
    userId: uuid('user_id').references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    // One row per student per event; re-registering reactivates this row. The
    // null `user_id` of a guest never collides, because Postgres treats nulls
    // as distinct in a unique constraint.
    unique('event_registration_event_user_unique').on(t.eventId, t.userId),
    // The seat count and the "who is coming" list both filter on this pair.
    index('event_registration_event_status_idx').on(t.eventId, t.status),
    // One visitor row per address per event, cancelled ones included: a
    // cancelled guest frees the seat but keeps their row, and re-registering
    // reactivates it, exactly like a student's. Scoping this to `confirmed`
    // would let a second row for the same address exist, and then "duplicate
    // email" would have two answers depending on history.
    uniqueIndex('event_registration_guest_unique')
      .on(t.eventId, sql`lower(${t.guestEmail})`)
      .where(sql`${t.guestEmail} is not null`),
    check(
      'event_registration_role_valid',
      sql`${t.role} IN (${sqlLiterals(eventRegistrationRoles)})`
    ),
    check(
      'event_registration_status_valid',
      sql`${t.status} IN (${sqlLiterals(eventRegistrationStatuses)})`
    ),
  ]
);

/** One answer to one of the event's questions, on one registration. */
export const eventRegistrationAnswer = pgTable(
  'event_registration_answer',
  {
    fieldId: uuid('field_id')
      .notNull()
      .references(() => eventField.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => eventRegistration.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
  },
  (t) => [
    // One answer per question; replacing the form replaces these rows.
    unique('event_registration_answer_unique').on(t.registrationId, t.fieldId),
  ]
);

/**
 * The QR ticket of one registration. Phase C issues one per guest; check-in is
 * the scanner phase's job, so the columns exist and stay null for now.
 */
export const eventTicket = pgTable(
  'event_ticket',
  {
    /** Set by the scanner phase; null until then. */
    checkedInAt: timestamp('checked_in_at'),
    /** The staff member who scanned it; null when they leave the school. */
    checkedInBy: uuid('checked_in_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    /** The QR payload: the ticket id and nothing else. */
    id: uuid('id').primaryKey().defaultRandom(),
    registrationId: uuid('registration_id')
      .notNull()
      .references(() => eventRegistration.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    // One ticket per registration: re-sending mails the same code.
    unique('event_ticket_registration_unique').on(t.registrationId),
  ]
);

/**
 * A helper's permission to scan tickets at one event's door.
 *
 * Approving a helper registration creates it, and it lapses on its own after
 * the event (its expiry is read on every check-in, never trusted to a cleanup
 * job). The pair is unique because one helper has one grant per event: a
 * re-approval refreshes the row instead of stacking a second one.
 */
export const eventCheckinGrant = pgTable(
  'event_checkin_grant',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    /** The moment the door closes for this helper; read at request time. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    // One grant per helper per event; an approval refreshes this row.
    unique('event_checkin_grant_user_event_unique').on(t.userId, t.eventId),
    // The picker and the cleanup job both read by event.
    index('event_checkin_grant_event_id_idx').on(t.eventId),
  ]
);

export const eventsSchema = {
  event,
  eventCheckinGrant,
  eventField,
  eventRegistration,
  eventRegistrationAnswer,
  eventTicket,
};
