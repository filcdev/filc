import type {
  EventParticipant,
  EventParticipantQueryInput,
} from '@filcdev/api/domains/events/registration';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  event,
  eventCheckinGrant,
  eventField,
  eventRegistration,
  eventRegistrationAnswer,
  eventRoom,
  eventTicket,
} from '#modules/events/schema';
import { andAll } from '#utils/drizzle';
import { notFound } from '#utils/http';

/**
 * The registrant is the account for a student and the guest fields otherwise.
 * `coalesce` keeps both columns one expression, so the row is one string pair
 * and the client never branches on who registered.
 */
const participantColumns = {
  checkedInAt: eventTicket.checkedInAt,
  checkinGrantExpiresAt: eventCheckinGrant.expiresAt,
  createdAt: eventRegistration.createdAt,
  email: sql<string>`coalesce(${user.email}, ${eventRegistration.guestEmail}, '')`,
  id: eventRegistration.id,
  name: sql<string>`coalesce(${user.name}, ${eventRegistration.guestName}, '')`,
  role: eventRegistration.role,
  roomId: eventRegistration.roomId,
  roomName: eventRoom.name,
  status: eventRegistration.status,
};

/** Escapes the LIKE metacharacters so a search for `100%` matches literally. */
const likePattern = (term: string): string =>
  `%${term.replace(/[\\%_]/g, '\\$&')}%`;

/** The WHERE of one participant page; its own function, so the count agrees. */
const buildWhere = (
  query: Pick<EventParticipantQueryInput, 'id' | 'role' | 'search' | 'status'>
): SQL<unknown> => {
  const filters: SQL<unknown>[] = [eq(eventRegistration.eventId, query.id)];

  if (query.role) {
    filters.push(eq(eventRegistration.role, query.role));
  }
  if (query.status) {
    filters.push(eq(eventRegistration.status, query.status));
  }
  if (query.search) {
    const pattern = likePattern(query.search);
    const match = or(
      ilike(user.name, pattern),
      ilike(user.email, pattern),
      ilike(eventRegistration.guestName, pattern),
      ilike(eventRegistration.guestEmail, pattern)
    );
    if (match) {
      filters.push(match);
    }
  }

  return andAll(filters) ?? eq(eventRegistration.eventId, query.id);
};

/** The answers of a page of registrations, with their questions, in one read. */
const answersFor = async (
  registrationIds: readonly string[]
): Promise<Map<string, EventParticipant['answers']>> => {
  const byRegistration = new Map<string, EventParticipant['answers']>();
  if (registrationIds.length === 0) {
    return byRegistration;
  }

  const rows = await db
    .select({
      fieldId: eventRegistrationAnswer.fieldId,
      label: eventField.label,
      registrationId: eventRegistrationAnswer.registrationId,
      type: eventField.type,
      value: eventRegistrationAnswer.value,
    })
    .from(eventRegistrationAnswer)
    .innerJoin(eventField, eq(eventRegistrationAnswer.fieldId, eventField.id))
    .where(
      inArray(eventRegistrationAnswer.registrationId, [...registrationIds])
    )
    .orderBy(eventField.position, eventField.id);

  for (const row of rows) {
    const answers = byRegistration.get(row.registrationId) ?? [];
    answers.push({
      fieldId: row.fieldId,
      label: row.label,
      type: row.type,
      value: row.value,
    });
    byRegistration.set(row.registrationId, answers);
  }

  return byRegistration;
};

/**
 * One page of an event's registrations, newest first, each with its registrant
 * and answers. `total` is the unpaged count of the same filter, so the table can
 * page without a second request.
 */
export const listEventRegistrations = async (
  query: EventParticipantQueryInput
): Promise<{ items: EventParticipant[]; total: number }> => {
  const where = buildWhere(query);

  const [rows, totalRows] = await Promise.all([
    db
      .select(participantColumns)
      .from(eventRegistration)
      .leftJoin(user, eq(eventRegistration.userId, user.id))
      .leftJoin(eventRoom, eq(eventRegistration.roomId, eventRoom.id))
      .leftJoin(
        eventTicket,
        eq(eventTicket.registrationId, eventRegistration.id)
      )
      // The grant is per helper and event, not per registration: the pair is
      // what identifies it. A guest has neither half and keeps a null.
      .leftJoin(
        eventCheckinGrant,
        and(
          eq(eventCheckinGrant.userId, eventRegistration.userId),
          eq(eventCheckinGrant.eventId, eventRegistration.eventId)
        )
      )
      .where(where)
      // Newest first; the id breaks a same-second tie so paging is stable.
      .orderBy(desc(eventRegistration.createdAt), desc(eventRegistration.id))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ value: count() })
      .from(eventRegistration)
      .leftJoin(user, eq(eventRegistration.userId, user.id))
      .where(where),
  ]);

  const answers = await answersFor(rows.map((row) => row.id));

  return {
    items: rows.map((row) => ({
      answers: answers.get(row.id) ?? [],
      checkedInAt: row.checkedInAt,
      checkinGrantExpiresAt: row.checkinGrantExpiresAt,
      email: row.email,
      id: row.id,
      name: row.name,
      registeredAt: row.createdAt,
      role: row.role,
      room:
        row.roomId && row.roomName
          ? { id: row.roomId, name: row.roomName }
          : null,
      status: row.status,
    })),
    total: Number(totalRows[0]?.value ?? 0),
  };
};

/** The event row, or the 404 every organizer read starts with. */
export const requireEvent = async (
  eventId: string
): Promise<typeof event.$inferSelect> => {
  const [row] = await db.select().from(event).where(eq(event.id, eventId));
  if (!row) {
    throw notFound('Event not found');
  }
  return row;
};
