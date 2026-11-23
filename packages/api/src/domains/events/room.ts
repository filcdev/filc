import z from 'zod';

/**
 * The body an organizer writes a room with: a name and the room's own seat
 * count. The capacity is always required and positive — an unlimited room would
 * be the event itself, which already has a nullable capacity.
 */
export const eventRoomWriteSchema = z.object({
  capacity: z.number().int().positive(),
  name: z.string().trim().min(1),
});

export type EventRoomWriteInput = z.infer<typeof eventRoomWriteSchema>;

/** An `event_room` row exactly as stored; what create and update answer. */
export const eventRoomSchema = eventRoomWriteSchema.extend({
  createdAt: z.date(),
  eventId: z.uuid(),
  id: z.uuid(),
  position: z.number(),
  updatedAt: z.date(),
});

export type EventRoom = z.infer<typeof eventRoomSchema>;

/**
 * A room as a registration names it. Deliberately two fields: a registration
 * carries the label a participant picked, not the room's seat count.
 */
export const eventRoomRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type EventRoomRef = z.infer<typeof eventRoomRefSchema>;

/**
 * A room on the public detail: its capacity and how many places are still
 * free. `remaining` is never negative, exactly like the event's own seats.
 */
export const eventRoomSummarySchema = eventRoomRefSchema.extend({
  capacity: z.number(),
  remaining: z.number(),
});

export type EventRoomSummary = z.infer<typeof eventRoomSummarySchema>;

/** `POST /events/{id}/rooms`: the event from the path plus the room's fields. */
export const eventRoomCreateInputSchema = eventRoomWriteSchema.extend({
  id: z.uuid(),
});

export type EventRoomCreateInput = z.infer<typeof eventRoomCreateInputSchema>;

/**
 * `PUT /events/{id}/rooms/{roomId}`: a full replace of the room's writable
 * fields, so an omitted one is a validation error rather than "keep the old".
 */
export const eventRoomUpdateInputSchema = eventRoomWriteSchema.extend({
  id: z.uuid(),
  roomId: z.uuid(),
});

export type EventRoomUpdateInput = z.infer<typeof eventRoomUpdateInputSchema>;

/** `DELETE /events/{id}/rooms/{roomId}`: the event and the room. */
export const eventRoomDeleteInputSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
});

export type EventRoomDeleteInput = z.infer<typeof eventRoomDeleteInputSchema>;
