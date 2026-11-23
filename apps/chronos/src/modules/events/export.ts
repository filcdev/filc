import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import {
  eventRegistration,
  eventRegistrationAnswer,
  eventRoom,
  eventTicket,
} from '#modules/events/schema';
import { eventFields } from '#modules/events/utils/events';
import { buildExportTable } from '#modules/events/utils/export';
import { requireEvent } from '#modules/events/utils/participants';
import { cohort } from '#modules/timetable/schema';
import { base } from '#orpc';
import { csvFile } from '#utils/csv';

const logger = getLogger(['chronos', 'events', 'export']);

/**
 * Every registration of one event as CSV, newest first: the fixed columns plus
 * one per custom question, in the event's position order. The header cells are
 * the stable keys every export in this API writes; the client localizes the
 * labels it shows in the spreadsheet.
 */
export const exportEventRegistrations = base.events.export
  .use(requireAuthorization(permissions.eventsManage))
  .handler(async ({ context, input }) => {
    await requireEvent(input.id);

    const [registrations, fields, rooms] = await Promise.all([
      db
        .select({
          checkedInAt: eventTicket.checkedInAt,
          cohortName: cohort.name,
          createdAt: eventRegistration.createdAt,
          email: sql<string>`coalesce(${user.email}, ${eventRegistration.guestEmail}, '')`,
          id: eventRegistration.id,
          name: sql<string>`coalesce(${user.name}, ${eventRegistration.guestName}, '')`,
          role: eventRegistration.role,
          roomName: eventRoom.name,
          status: eventRegistration.status,
        })
        .from(eventRegistration)
        .leftJoin(user, eq(eventRegistration.userId, user.id))
        .leftJoin(cohort, eq(user.cohortId, cohort.id))
        .leftJoin(eventRoom, eq(eventRegistration.roomId, eventRoom.id))
        .leftJoin(
          eventTicket,
          eq(eventTicket.registrationId, eventRegistration.id)
        )
        .where(eq(eventRegistration.eventId, input.id))
        .orderBy(desc(eventRegistration.createdAt), desc(eventRegistration.id)),
      eventFields(input.id),
      // Only the presence of a room matters here: the column appears with the
      // first room and disappears with the last, so an export never carries an
      // always-empty column.
      db
        .select({ id: eventRoom.id })
        .from(eventRoom)
        .where(eq(eventRoom.eventId, input.id))
        .limit(1),
    ]);

    const answersByRegistration = new Map<string, Map<string, string>>();
    if (registrations.length > 0) {
      const answers = await db
        .select({
          fieldId: eventRegistrationAnswer.fieldId,
          registrationId: eventRegistrationAnswer.registrationId,
          value: eventRegistrationAnswer.value,
        })
        .from(eventRegistrationAnswer)
        .where(
          inArray(
            eventRegistrationAnswer.registrationId,
            registrations.map((row) => row.id)
          )
        );

      for (const answer of answers) {
        const byField =
          answersByRegistration.get(answer.registrationId) ??
          new Map<string, string>();
        byField.set(answer.fieldId, answer.value);
        answersByRegistration.set(answer.registrationId, byField);
      }
    }

    const hasRooms = rooms.length > 0;
    const { header, rows } = buildExportTable(
      fields,
      registrations,
      answersByRegistration,
      hasRooms
    );

    logger.info('event registrations exported', {
      columns: header.length,
      eventId: input.id,
      hasRooms,
      questions: fields.length,
      requestId: context.requestId,
      rows: rows.length,
    });

    return csvFile('event-registrations', header, rows);
  });
