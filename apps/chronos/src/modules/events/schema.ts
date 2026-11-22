import {
  type EventCategory,
  type EventStatus,
  eventCategories,
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
import type { EventCheckinRule } from '@filcdev/api/domains/events/rules';
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
    /** Null means unlimited; only confirmed helper rows consume this cap. */
    helperCapacity: integer('helper_capacity'),
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
    check(
      'event_helper_capacity_positive',
      sql`${t.helperCapacity} IS NULL OR ${t.helperCapacity} > 0`
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
 * One room of an event, with its own seat count. A room belongs to exactly one
 * event (`on delete cascade`), so deleting the event takes its rooms with it;
 * the organizer orders them with `position`, exactly like the signup questions.
 * A room's capacity counts on top of the event's own: a student fills one room
 * seat *and* one event seat.
 */
export const eventRoom = pgTable(
  'event_room',
  {
    capacity: integer('capacity').notNull(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    // The detail read always lists a room by event; without this every read
    // scans the whole table.
    index('event_room_event_id_idx').on(t.eventId),
    check('event_room_capacity_positive', sql`${t.capacity} > 0`),
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
    /**
     * The room the student picked. Null for a helper (they take no seat) and
     * for an event without rooms. A deleted room leaves its registrations
     * behind with a null room, which is why the delete is refused while any
     * row still names it.
     */
    roomId: uuid('room_id').references(() => eventRoom.id, {
      onDelete: 'set null',
    }),
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
    // A room's occupancy is counted by room, so this is what every registration
    // write and the detail read filter on.
    index('event_registration_room_id_idx').on(t.roomId),
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
 * The QR ticket of one registration — guest, student or helper alike. The
 * scanner's `checkInTicketAtDoor` is what sets `checkedInAt`/`checkedInBy`.
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
    /**
     * When the ticket mail was handed to the transport. Null until a successful
     * send, and left null when the send fails, so a resend can be told apart
     * from a first delivery that never left.
     */
    sentAt: timestamp('sent_at', { withTimezone: true }),
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

/**
 * The door rules of one scanner. A null `user_id` is the event's default; a
 * set one is that helper's own rules, which win when they scan.
 *
 * The rule list stays a JSONB column because it is read and replaced whole with
 * its config row, and the upsert validator keeps every reference inside the
 * event. Two partial unique indexes are what make "one default and one config
 * per helper" true: Postgres treats nulls as distinct, so a plain unique on
 * `(event_id, user_id)` would let an event stack defaults.
 */
export const eventCheckinConfig = pgTable(
  'event_checkin_config',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => event.id, { onDelete: 'cascade' }),
    id: uuid('id').primaryKey().defaultRandom(),
    /** The ordered rules; the last one is the catch-all. */
    rules: jsonb('rules')
      .$type<EventCheckinRule[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Null is the event default; a set id is that helper's override. */
    userId: uuid('user_id').references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    // One override per helper per event.
    uniqueIndex('event_checkin_config_event_user_unique')
      .on(t.eventId, t.userId)
      .where(sql`${t.userId} is not null`),
    // At most one default per event. The two indexes are separate because a
    // partial index cannot express "unique among the null rows" on its own.
    uniqueIndex('event_checkin_config_event_default_unique')
      .on(t.eventId)
      .where(sql`${t.userId} is null`),
  ]
);

export const eventsSchema = {
  event,
  eventCheckinConfig,
  eventCheckinGrant,
  eventField,
  eventRegistration,
  eventRegistrationAnswer,
  eventRoom,
  eventTicket,
};
