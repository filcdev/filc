import z from 'zod';
import { listResponse, paginationSchema } from '../list';
import { blockContentSchema, uniqueIdList } from '../news/announcements';
import {
  type EventFieldAudience,
  type EventFieldType,
  eventFieldSchema,
} from './fields';
import { eventRegistrationSchema } from './registration';

/**
 * The seven fixed event categories. Each one is a hint for the organizer's
 * dialog (see `categoryDefaults`); the per-event columns are always what the
 * backend enforces.
 */
export const eventCategories = [
  'honfoglalo',
  'open_day',
  'career_day',
  'digital_week',
  'codeweek',
  'fair',
  'external',
] as const;

export type EventCategory = (typeof eventCategories)[number];

export const eventCategorySchema = z.enum(eventCategories);

/** Draft and archived events stay out of the public list. */
export const eventStatuses = ['draft', 'published', 'archived'] as const;

export type EventStatus = (typeof eventStatuses)[number];

export const eventStatusSchema = z.enum(eventStatuses);

/**
 * How much the scanner reveals on a successful check-in. The setting is about
 * the screen at the door, so it applies to every outcome, not only an
 * admission: a cancelled ticket must not leak more than a valid one.
 */
export const eventCheckinDisplays = ['minimal', 'name', 'full'] as const;

export type EventCheckinDisplay = (typeof eventCheckinDisplays)[number];

export const eventCheckinDisplaySchema = z.enum(eventCheckinDisplays);

/**
 * What a category pre-fills in the organizer's dialog. Deliberately data, not
 * a rule: every value below is an editable field on the event itself, and the
 * backend never consults this map.
 */
export type EventCategoryDefaults = {
  /** Which audiences a newly added custom question starts with. */
  audiences: EventFieldAudience[];
  /** Whether the event starts with its signup form switched on. */
  registrationEnabled: boolean;
};

const CATEGORY_DEFAULTS: Record<EventCategory, EventCategoryDefaults> = {
  career_day: { audiences: ['student'], registrationEnabled: true },
  codeweek: { audiences: ['student'], registrationEnabled: false },
  digital_week: { audiences: ['student'], registrationEnabled: false },
  external: { audiences: ['guest', 'student'], registrationEnabled: false },
  fair: { audiences: ['student'], registrationEnabled: true },
  honfoglalo: { audiences: ['student'], registrationEnabled: true },
  open_day: { audiences: ['guest'], registrationEnabled: true },
};

/** The dialog defaults for a category; never enforced server-side. */
export const categoryDefaults = (
  category: EventCategory
): EventCategoryDefaults => CATEGORY_DEFAULTS[category];

/**
 * The condition an organizer may put on a helper application. Which ops a
 * question accepts depends on its type; the backend validates that pair, and
 * the shared enum lets the editor offer only the valid ones.
 */
export const eventHelperRequirementOps = [
  'equals',
  'contains',
  'gte',
  'lte',
  'is_true',
  'is_false',
] as const;

export type EventHelperRequirementOp =
  (typeof eventHelperRequirementOps)[number];

export const eventHelperRequirementOpSchema = z.enum(eventHelperRequirementOps);

/**
 * Which operators make sense for each question type. The backend rejects a
 * pair outside its row and the editor offers only these, so the rule has one
 * home. A checkbox carries no value (`is_true`/`is_false` read its state); a
 * number is compared numerically, a text field case/diacritic-insensitively.
 */
export const helperRequirementOpsByFieldType: Record<
  EventFieldType,
  readonly EventHelperRequirementOp[]
> = {
  checkbox: ['is_true', 'is_false'],
  number: ['equals', 'gte', 'lte'],
  select: ['equals'],
  text: ['equals', 'contains'],
  textarea: ['equals', 'contains'],
};

/**
 * One condition on the helper signup: the applicant's answer to `fieldId` must
 * satisfy `op` against `value`. `value` is a string even for a number or a
 * checkbox so the stored shape is one row; the matcher parses it per type.
 */
export const eventHelperRequirementSchema = z.object({
  fieldId: z.uuid(),
  op: eventHelperRequirementOpSchema,
  value: z.string(),
});

export type EventHelperRequirement = z.infer<
  typeof eventHelperRequirementSchema
>;

/** An `event` row exactly as stored. */
export const eventRowSchema = z.object({
  capacity: z.number().nullable(),
  category: eventCategorySchema,
  /** What the door's scanner reveals; `name` unless the organizer changes it. */
  checkinDisplay: eventCheckinDisplaySchema,
  /**
   * The answers the scanner returns, in this order. Empty means the identity
   * setting is all a check-in reveals.
   */
  checkinFields: z.array(z.uuid()),
  createdAt: z.date(),
  createdBy: z.uuid().nullable(),
  description: z.json(),
  endsAt: z.date(),
  /** Whether a visitor may sign up without an account. Its own switch. */
  guestRegistrationEnabled: z.boolean(),
  /**
   * The grade band helpers sign up in. Either bound governs helpers when set;
   * with both null the event's own `minGrade`/`maxGrade` apply to them too.
   */
  helperMaxGrade: z.number().nullable(),
  helperMinGrade: z.number().nullable(),
  helperRegistrationClosesAt: z.date().nullable(),
  /**
   * Whether students may sign up as helpers. Off by default, and inert until
   * the master `registrationEnabled` is on as well.
   */
  helperRegistrationEnabled: z.boolean(),
  helperRegistrationOpensAt: z.date().nullable(),
  /**
   * When on, helpers get their own window instead of the participant one. When
   * off, `helperRegistrationOpensAt`/`helperRegistrationClosesAt` are ignored.
   */
  helperRegistrationSeparateWindow: z.boolean(),
  /**
   * The answers a helper application has to satisfy, in the organizer's order.
   * Empty means every student may apply.
   */
  helperRequirements: z.array(eventHelperRequirementSchema),
  id: z.uuid(),
  imageByteSize: z.number().nullable(),
  imageContentType: z.string().nullable(),
  imageKey: z.string().nullable(),
  imageUpdatedAt: z.date().nullable(),
  maxGrade: z.number().nullable(),
  minGrade: z.number().nullable(),
  registrationClosesAt: z.date().nullable(),
  registrationEnabled: z.boolean(),
  registrationOpensAt: z.date().nullable(),
  startsAt: z.date(),
  status: eventStatusSchema,
  title: z.string(),
  updatedAt: z.date(),
});

/** An event plus the cohorts it targets; an empty list means every student. */
export const eventTargetedRowSchema = eventRowSchema.extend({
  cohortIds: z.array(z.uuid()),
});

/**
 * Capacity as the client sees it. `remaining` is null for an unlimited event,
 * never negative. Every confirmed registration that is not a helper takes a
 * seat, visitors included; only helpers are exempt.
 */
export const eventSeatsSchema = z.object({
  capacity: z.number().nullable(),
  remaining: z.number().nullable(),
  taken: z.number(),
});

export type EventSeats = z.infer<typeof eventSeatsSchema>;

/**
 * Why a caller may not register, or `null` when they may.
 *
 * `sign_in_required` is the anonymous case the views turn into a sign-in call;
 * the rest come from the server's registration rules. The list is closed so a
 * client can map every value to copy and the backend cannot invent one.
 */
export const eventEligibilityReasons = [
  'sign_in_required',
  'not_open_yet',
  'closed',
  'registration_disabled',
  'helper_registration_disabled',
  'wrong_cohort',
  'grade_too_low',
  'grade_too_high',
  'already_registered',
  'pending_approval',
  'full',
  'grade_unknown',
  'requirement_unmet',
] as const;

export type EventEligibilityReason =
  | (typeof eventEligibilityReasons)[number]
  | null;

export const eventEligibilitySchema = z.object({
  eligible: z.boolean(),
  reason: z.enum(eventEligibilityReasons).nullable(),
  /**
   * The question a `requirement_unmet` refusal is about, so the public page can
   * name it in the viewer's own language. Null for every other reason.
   */
  reasonField: z.string().nullable(),
});

export type EventEligibility = z.infer<typeof eventEligibilitySchema>;

/**
 * An event as every endpoint answers it. `cohortIds` is registration scope, not
 * visibility: a published event is visible to everyone, and only a listed
 * cohort may sign up.
 */
export const eventItemSchema = eventTargetedRowSchema.extend({
  eligibility: eventEligibilitySchema,
  seats: eventSeatsSchema,
});

export type EventItem = z.infer<typeof eventItemSchema>;

/**
 * The detail endpoint: everything the organizer dialog edits, in one read, plus
 * the caller's own registration — cancelled rows included, so a student sees
 * what they cancelled.
 */
export const eventDetailSchema = eventItemSchema.extend({
  fields: z.array(eventFieldSchema),
  /**
   * Whether this caller may sign up as a helper, judged by the helper rules.
   * Detail-only: the list has no per-viewer helper action, and computing this
   * for every row would cost a registration read per event.
   */
  helperEligibility: eventEligibilitySchema,
  myRegistration: eventRegistrationSchema.nullable(),
});

export type EventDetail = z.infer<typeof eventDetailSchema>;

/** Payload of `GET /events`. */
export const eventListResponseSchema = listResponse(eventItemSchema);

export const eventQuerySchema = paginationSchema.extend({
  category: eventCategorySchema.optional(),
  /** Honour only when the caller may manage events; drafts stay hidden otherwise. */
  includeDrafts: z.stringbool().default(false),
  /** Honoured for a manager regardless of `includeDrafts`; anyone else gets published rows. */
  status: eventStatusSchema.optional(),
});

export type EventQueryInput = z.infer<typeof eventQuerySchema>;

/**
 * The fields an event is written with. `fields` are replaced by their own
 * endpoint; `cohortIds` rides along here because it is a flat list, exactly
 * like announcement targeting.
 */
const eventWriteFieldsSchema = z.object({
  capacity: z.number().int().positive().nullable().optional(),
  category: eventCategorySchema,
  /** What the door's scanner reveals; omitted means the column default. */
  checkinDisplay: eventCheckinDisplaySchema.optional(),
  /**
   * The answers the door returns; each must be a question of this event, and a
   * removed question is pruned from the list. Omitted means empty.
   */
  checkinFields: uniqueIdList(z.uuid()).optional(),
  /** Registration scope, never visibility: empty means every student. */
  cohortIds: uniqueIdList(z.uuid()).optional(),
  description: blockContentSchema,
  endsAt: z.coerce.date(),
  /** Visitors sign up without an account only when this switch is on. */
  guestRegistrationEnabled: z.boolean().optional(),
  /** Helper grade bounds; null leaves the event's own bounds in charge. */
  helperMaxGrade: z.number().int().min(1).max(13).nullable().optional(),
  helperMinGrade: z.number().int().min(1).max(13).nullable().optional(),
  helperRegistrationClosesAt: z.coerce.date().nullable().optional(),
  /** Students sign up as helpers only while this switch is on. */
  helperRegistrationEnabled: z.boolean().optional(),
  helperRegistrationOpensAt: z.coerce.date().nullable().optional(),
  /** When on, the helper window below replaces the participant window. */
  helperRegistrationSeparateWindow: z.boolean().optional(),
  /** The answered conditions a helper application must satisfy. */
  helperRequirements: z.array(eventHelperRequirementSchema).optional(),
  maxGrade: z.number().int().min(1).max(13).nullable().optional(),
  minGrade: z.number().int().min(1).max(13).nullable().optional(),
  registrationClosesAt: z.coerce.date().nullable().optional(),
  registrationEnabled: z.boolean().optional(),
  registrationOpensAt: z.coerce.date().nullable().optional(),
  startsAt: z.coerce.date(),
  status: eventStatusSchema.optional(),
  title: z.string().min(1),
});

const datesInvalid = 'The event must end on or after it starts';
const windowInvalid = 'Registration must close on or after it opens';
const helperWindowInvalid =
  'Helper registration must close on or after it opens';
const gradesInvalid = 'The maximum grade must be at least the minimum grade';
const helperGradesInvalid =
  'The helper maximum grade must be at least the helper minimum grade';

function orderedDates(values: { startsAt?: Date; endsAt?: Date }): boolean {
  return (
    !(values.startsAt && values.endsAt) || values.endsAt >= values.startsAt
  );
}

function orderedWindow(values: {
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
}): boolean {
  return (
    !(values.registrationOpensAt && values.registrationClosesAt) ||
    values.registrationClosesAt >= values.registrationOpensAt
  );
}

function orderedGrades(values: {
  minGrade?: number | null;
  maxGrade?: number | null;
}): boolean {
  return (
    !(values.minGrade != null && values.maxGrade != null) ||
    values.maxGrade >= values.minGrade
  );
}

/** The helper pair is its own band; a participant bound does not decide it. */
function orderedHelperGrades(values: {
  helperMinGrade?: number | null;
  helperMaxGrade?: number | null;
}): boolean {
  return (
    !(values.helperMinGrade != null && values.helperMaxGrade != null) ||
    values.helperMaxGrade >= values.helperMinGrade
  );
}

/** The helper window is its own pair; the shared window is checked above. */
function orderedHelperWindow(values: {
  helperRegistrationOpensAt?: Date | null;
  helperRegistrationClosesAt?: Date | null;
}): boolean {
  return (
    !(values.helperRegistrationOpensAt && values.helperRegistrationClosesAt) ||
    values.helperRegistrationClosesAt >= values.helperRegistrationOpensAt
  );
}

export const eventCreateSchema = eventWriteFieldsSchema
  .refine((data) => orderedDates(data), {
    message: datesInvalid,
    path: ['endsAt'],
  })
  .refine((data) => orderedWindow(data), {
    message: windowInvalid,
    path: ['registrationClosesAt'],
  })
  .refine((data) => orderedHelperWindow(data), {
    message: helperWindowInvalid,
    path: ['helperRegistrationClosesAt'],
  })
  .refine((data) => orderedGrades(data), {
    message: gradesInvalid,
    path: ['maxGrade'],
  })
  .refine((data) => orderedHelperGrades(data), {
    message: helperGradesInvalid,
    path: ['helperMaxGrade'],
  });

export type EventCreateInput = z.infer<typeof eventCreateSchema>;

export const eventUpdateSchema = eventWriteFieldsSchema
  .partial()
  .refine((data) => orderedDates(data), {
    message: datesInvalid,
    path: ['endsAt'],
  })
  .refine((data) => orderedWindow(data), {
    message: windowInvalid,
    path: ['registrationClosesAt'],
  })
  .refine((data) => orderedHelperWindow(data), {
    message: helperWindowInvalid,
    path: ['helperRegistrationClosesAt'],
  })
  .refine((data) => orderedGrades(data), {
    message: gradesInvalid,
    path: ['maxGrade'],
  })
  .refine((data) => orderedHelperGrades(data), {
    message: helperGradesInvalid,
    path: ['helperMaxGrade'],
  });

export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;

/**
 * The banner upload body. Only the file's presence is checked here; the size
 * cap and mime allowlist are enforced by the handler, because zod's file
 * schema validates neither.
 */
export const eventImageUploadSchema = z.object({ file: z.file() });

/** Detail reads take the admin flag so an organizer can open a draft. */
export const eventGetInputSchema = z.object({
  id: z.uuid(),
  includeDrafts: z.stringbool().default(false),
});

export const eventIdInputSchema = z.object({ id: z.uuid() });
