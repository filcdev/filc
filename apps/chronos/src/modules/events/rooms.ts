import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { and, count, eq, max } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { event, eventRegistration, eventRoom } from '#modules/events/schema';
import { base } from '#orpc';
import { notFound, roomHasRegistrations, roomNotFound } from '#utils/http';

const logger = getLogger(['chronos', 'events', 'rooms']);

/** The event row, or the 404 every organizer write starts with. */
const requireEventRow = async (eventId: string) => {
  const [row] = await db
    .select({ id: event.id })
    .from(event)
    .where(eq(event.id, eventId));
  if (!row) {
    throw notFound('Event not found');
  }
  return row;
};

/**
 * A new room of an event, appended to the organizer's order: `position` is the
 * highest existing one plus one, so the last created room is last on the page.
 */
export const createEventRoom = base.events.rooms.create
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    await requireEventRow(input.id);

    const [last] = await db
      .select({ value: max(eventRoom.position) })
      .from(eventRoom)
      .where(eq(eventRoom.eventId, input.id));

    const [created] = await db
      .insert(eventRoom)
      .values({
        capacity: input.capacity,
        eventId: input.id,
        name: input.name,
        position: Number(last?.value ?? -1) + 1,
      })
      .returning();
    if (!created) {
      throw new Error('Failed to create the room');
    }

    logger.info('event room created', {
      capacity: created.capacity,
      eventId: input.id,
      requestId: context.requestId,
      roomId: created.id,
    });

    return created;
  });

/**
 * Replaces a room's name and capacity. The room is looked up by the event and
 * the id together, so another event's room is a 404 rather than an edit.
 */
export const updateEventRoom = base.events.rooms.update
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    const [existing] = await db
      .select()
      .from(eventRoom)
      .where(
        and(eq(eventRoom.eventId, input.id), eq(eventRoom.id, input.roomId))
      );
    if (!existing) {
      throw roomNotFound('Room not found');
    }

    const [updated] = await db
      .update(eventRoom)
      .set({ capacity: input.capacity, name: input.name })
      .where(eq(eventRoom.id, input.roomId))
      .returning();
    if (!updated) {
      throw roomNotFound('Room not found');
    }

    logger.info('event room updated', {
      capacity: updated.capacity,
      eventId: input.id,
      requestId: context.requestId,
      roomId: updated.id,
    });

    return updated;
  });

/**
 * Deletes a room, refusing while any registration names it. The event row is
 * locked first — the lock every registration write takes — so a registration
 * cannot slip in between the count and the delete and leave a roomless row.
 */
export const deleteEventRoom = base.events.rooms.delete
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    await db.transaction(async (tx) => {
      const [eventRow] = await tx
        .select({ id: event.id })
        .from(event)
        .where(eq(event.id, input.id))
        .for('update');
      if (!eventRow) {
        throw notFound('Event not found');
      }

      const [room] = await tx
        .select()
        .from(eventRoom)
        .where(
          and(eq(eventRoom.eventId, input.id), eq(eventRoom.id, input.roomId))
        );
      if (!room) {
        throw roomNotFound('Room not found');
      }

      // Every row counts, cancelled ones included: a room a registration once
      // named is history, and deleting it would blank that cell of the export.
      const [used] = await tx
        .select({ value: count() })
        .from(eventRegistration)
        .where(eq(eventRegistration.roomId, input.roomId));
      if ((used?.value ?? 0) > 0) {
        throw roomHasRegistrations('This room already has registrations');
      }

      await tx.delete(eventRoom).where(eq(eventRoom.id, input.roomId));
    });

    logger.info('event room deleted', {
      eventId: input.id,
      requestId: context.requestId,
      roomId: input.roomId,
    });

    return { id: input.roomId };
  });
