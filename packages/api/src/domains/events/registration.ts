import z from 'zod';
import { paginationSchema } from '../list';
import { eventFieldTypeSchema } from './fields';
import { eventRoomRefSchema } from './room';

/**
 * Who a registration is for. A `participant` (a student) and a `visitor` (a
 * guest, typically a parent) take a seat; only a `helper` is exempt.
 */
export const eventRegistrationRoles = [
  'participant',
  'helper',
  'visitor',
] as const;

export type EventRegistrationRole = (typeof eventRegistrationRoles)[number];

export const eventRegistrationRoleSchema = z.enum(eventRegistrationRoles);

/**
 * A cancelled registration is kept, not deleted: cancelling frees the seat, and
 * registering again reactivates the same row with its answers. A helper's row
 * starts `pending` and an organizer approves it into `confirmed` (a decline
 * cancels it).
 */
export const eventRegistrationStatuses = [
  'pending',
  'confirmed',
  'cancelled',
] as const;

export type EventRegistrationStatus =
  (typeof eventRegistrationStatuses)[number];

export const eventRegistrationStatusSchema = z.enum(eventRegistrationStatuses);

/**
 * The roles a student may sign themselves up as. A visitor has its own public
 * endpoint, and a helper is always a signed-in student.
 */
export const eventSignupRoles = ['participant', 'helper'] as const;

export type EventSignupRole = (typeof eventSignupRoles)[number];

export const eventSignupRoleSchema = z.enum(eventSignupRoles);

/** One answer on a registration, keyed to the question it answers. */
export const eventRegistrationAnswerSchema = z.object({
  fieldId: z.uuid(),
  value: z.string(),
});

export type EventRegistrationAnswer = z.infer<
  typeof eventRegistrationAnswerSchema
>;

/**
 * A registration as the API returns it, with the caller's answers. A student
 * has a `userId` and no guest fields; a visitor has the opposite.
 */
export const eventRegistrationSchema = z.object({
  answers: z.array(eventRegistrationAnswerSchema),
  createdAt: z.date(),
  eventId: z.uuid(),
  /** The visitor's address; null for a signed-in student. */
  guestEmail: z.string().nullable(),
  /** The visitor's name; null for a signed-in student. */
  guestName: z.string().nullable(),
  id: z.uuid(),
  role: eventRegistrationRoleSchema,
  /** The room the student picked; null for a helper or a roomless event. */
  room: eventRoomRefSchema.nullable(),
  status: eventRegistrationStatusSchema,
  updatedAt: z.date(),
  userId: z.uuid().nullable(),
});

export type EventRegistrationItem = z.infer<typeof eventRegistrationSchema>;

/**
 * The body of `POST /events/{id}/registrations`: which side of the event the
 * caller is signing up for, and the custom questions they answered. Every other
 * condition comes from the event's own columns.
 */
export const eventRegistrationCreateSchema = z.object({
  answers: z.array(eventRegistrationAnswerSchema).optional(),
  /** A helper signup is created pending; a participant is confirmed at once. */
  role: eventSignupRoleSchema.default('participant'),
  /**
   * The room a participant picks. Required once the event has rooms, and
   * rejected when it names a room of another event or of no event at all.
   */
  roomId: z.uuid().optional(),
});

export type EventRegistrationCreateInput = z.infer<
  typeof eventRegistrationCreateSchema
>;

/** `DELETE /events/{id}/registrations/{registrationId}`: the event and the row. */
export const eventRegistrationCancelInputSchema = z.object({
  id: z.uuid(),
  registrationId: z.uuid(),
});

export type EventRegistrationCancelInput = z.infer<
  typeof eventRegistrationCancelInputSchema
>;

/** The two answers an organizer may give a pending helper registration. */
export const eventRegistrationDecisions = ['approve', 'decline'] as const;

export type EventRegistrationDecision =
  (typeof eventRegistrationDecisions)[number];

export const eventRegistrationDecisionSchema = z.enum(
  eventRegistrationDecisions
);

/**
 * `POST /events/{id}/registrations/{registrationId}/decision`: approve a
 * pending helper (it becomes confirmed) or decline one (it is cancelled).
 */
export const eventRegistrationDecideInputSchema =
  eventRegistrationCancelInputSchema.extend({
    decision: eventRegistrationDecisionSchema,
  });

export type EventRegistrationDecideInput = z.infer<
  typeof eventRegistrationDecideInputSchema
>;

/**
 * One answer as the organizer's participant list reads it. The question's label
 * and type ride along, denormalized, so a page of registrations renders without
 * a second request for the event's question set.
 */
export const eventRegistrationAnswerViewSchema = z.object({
  fieldId: z.uuid(),
  label: z.string(),
  type: eventFieldTypeSchema,
  value: z.string(),
});

export type EventRegistrationAnswerView = z.infer<
  typeof eventRegistrationAnswerViewSchema
>;

/**
 * One registration as the organizer sees it: the registrant's own identity
 * (the account for a student, the guest fields for a visitor), the answers and
 * the ticket's check-in time when the scanner phase has stamped one.
 */
export const eventParticipantSchema = z.object({
  answers: z.array(eventRegistrationAnswerViewSchema),
  /** Null until someone scans the ticket; guests have one, students may not. */
  checkedInAt: z.date().nullable(),
  /**
   * When this helper's door grant lapses; null for a participant, a guest or a
   * helper who has not been approved. An approval is what creates it.
   */
  checkinGrantExpiresAt: z.date().nullable(),
  email: z.string(),
  id: z.uuid(),
  name: z.string(),
  registeredAt: z.date(),
  role: eventRegistrationRoleSchema,
  /** The room this person picked; null when the event has no rooms. */
  room: eventRoomRefSchema.nullable(),
  status: eventRegistrationStatusSchema,
});

export type EventParticipant = z.infer<typeof eventParticipantSchema>;

/**
 * `GET /events/{id}/registrations`: the event id plus the page window and the
 * organizer's filters. `search` matches the name and the email of a student or
 * a visitor, case-insensitively.
 */
export const eventParticipantQuerySchema = paginationSchema.extend({
  id: z.uuid(),
  role: eventRegistrationRoleSchema.optional(),
  search: z.string().trim().min(1).optional(),
  status: eventRegistrationStatusSchema.optional(),
});

export type EventParticipantQueryInput = z.infer<
  typeof eventParticipantQuerySchema
>;
