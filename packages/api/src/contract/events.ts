import { oc } from '@orpc/contract';
import z from 'zod';
import {
  eventCreateSchema,
  eventDetailSchema,
  eventGetInputSchema,
  eventIdInputSchema,
  eventImageUploadSchema,
  eventItemSchema,
  eventListResponseSchema,
  eventQuerySchema,
  eventUpdateSchema,
} from '../domains/events/event';
import {
  eventFieldSchema,
  eventFieldsReplaceSchema,
} from '../domains/events/fields';
import {
  eventGuestCreateSchema,
  eventGuestResultSchema,
} from '../domains/events/guest';
import {
  eventParticipantQuerySchema,
  eventParticipantSchema,
  eventRegistrationCancelInputSchema,
  eventRegistrationCreateSchema,
  eventRegistrationDecideInputSchema,
  eventRegistrationSchema,
} from '../domains/events/registration';
import { eventStatsSchema } from '../domains/events/stats';
import { listResponse } from '../domains/list';
import { filcRoute } from './route';

const EVENT_TAGS = ['Events'];

const deleteResponseSchema = z.object({ id: z.uuid() });

/**
 * Registration is not a visibility rule: every published event is listed for
 * everyone, anonymous visitors included, and `cohortIds` decides who may sign
 * up once registration is open.
 */
export const eventsContract = {
  create: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Create a school event',
        method: 'POST',
        operationId: 'postEvents',
        path: '/events',
        successStatus: 201,
        tags: EVENT_TAGS,
      })
    )
    .input(eventCreateSchema)
    .output(eventItemSchema),
  delete: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Delete an event and its banner',
        method: 'DELETE',
        operationId: 'deleteEventsById',
        path: '/events/{id}',
        tags: EVENT_TAGS,
      })
    )
    .input(eventIdInputSchema)
    .output(deleteResponseSchema),
  deleteImage: oc
    .route(
      filcRoute({
        auth: true,
        description: "Delete an event's banner",
        method: 'DELETE',
        operationId: 'deleteEventsByIdImage',
        path: '/events/{id}/image',
        tags: EVENT_TAGS,
      })
    )
    .input(eventIdInputSchema)
    .output(deleteResponseSchema),
  export: oc
    .route(
      filcRoute({
        auth: true,
        description:
          "Export an event's registrations as CSV, one column per custom question in position order",
        method: 'GET',
        operationId: 'getEventsByIdExport',
        path: '/events/{id}/export',
        tags: EVENT_TAGS,
      })
    )
    .input(eventIdInputSchema)
    .output(z.file()),
  fields: {
    replace: oc
      .route(
        filcRoute({
          auth: true,
          description: "Replace an event's custom signup questions",
          method: 'PUT',
          operationId: 'putEventsByIdFields',
          path: '/events/{id}/fields',
          tags: EVENT_TAGS,
        })
      )
      .input(eventFieldsReplaceSchema)
      .output(listResponse(eventFieldSchema)),
  },
  get: oc
    .route(
      filcRoute({
        description:
          "Get one event with its questions, seat counts and the caller's own registration. Every published event is visible to everyone; cohortIds limits who may register, not who may see it",
        method: 'GET',
        operationId: 'getEventsById',
        path: '/events/{id}',
        tags: EVENT_TAGS,
      })
    )
    .input(eventGetInputSchema)
    .output(eventDetailSchema),
  /**
   * Guest signup: a visitor (typically a parent) registers without an account
   * and gets a ticket by email. Public on purpose, and gated by the event's own
   * `guestRegistrationEnabled` switch plus its registration window.
   */
  guests: {
    create: oc
      .route(
        filcRoute({
          description:
            'Register a visitor without an account and email them a ticket; the event must have guest signup on',
          method: 'POST',
          operationId: 'postEventsByIdGuests',
          path: '/events/{id}/guests',
          successStatus: 201,
          tags: EVENT_TAGS,
        })
      )
      .input(eventGuestCreateSchema.extend({ id: z.uuid() }))
      .output(eventGuestResultSchema),
  },
  image: oc
    .route(
      filcRoute({
        description: "Serve an event's banner image",
        method: 'GET',
        operationId: 'getEventsByIdImage',
        path: '/events/{id}/image',
        tags: EVENT_TAGS,
      })
    )
    .input(eventGetInputSchema)
    .output(z.file()),
  list: oc
    .route(
      filcRoute({
        description:
          'List events; published unless the caller may manage events, who can ask for drafts or for one status. Every published event is visible to everyone; cohortIds limits who may register, not who may see it',
        method: 'GET',
        operationId: 'getEvents',
        path: '/events',
        tags: EVENT_TAGS,
      })
    )
    .input(eventQuerySchema)
    .output(eventListResponseSchema),
  registrations: {
    cancel: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Cancel a confirmed registration and free its seat; a student may cancel only their own, an organizer any registration of the event, and answers stay for the record',
          method: 'DELETE',
          operationId: 'deleteEventsByIdRegistrationsByRegistrationId',
          path: '/events/{id}/registrations/{registrationId}',
          tags: EVENT_TAGS,
        })
      )
      .input(eventRegistrationCancelInputSchema)
      .output(deleteResponseSchema),
    create: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Register the caller for a published event as a participant or a helper, answering its student questions; a helper signup starts pending approval, a cancelled registration is reactivated, so both answer 200',
          method: 'POST',
          operationId: 'postEventsByIdRegistrations',
          path: '/events/{id}/registrations',
          tags: EVENT_TAGS,
        })
      )
      .input(eventRegistrationCreateSchema.extend({ id: z.uuid() }))
      .output(eventRegistrationSchema),
    /**
     * The organizer's answer to a pending helper signup: approve confirms it,
     * decline cancels it.
     */
    decide: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Approve or decline a pending helper registration; any other status answers 409',
          method: 'POST',
          operationId: 'postEventsByIdRegistrationsByRegistrationIdDecision',
          path: '/events/{id}/registrations/{registrationId}/decision',
          tags: EVENT_TAGS,
        })
      )
      .input(eventRegistrationDecideInputSchema)
      .output(eventRegistrationSchema),
    /**
     * The organizer's participant list: every registration of the event, with
     * its registrant and answers, filtered and paged.
     */
    list: oc
      .route(
        filcRoute({
          auth: true,
          description:
            "List an event's registrations with their registrant and answers, filtered by role, status and a name or email search",
          method: 'GET',
          operationId: 'getEventsByIdRegistrations',
          path: '/events/{id}/registrations',
          tags: EVENT_TAGS,
        })
      )
      .input(eventParticipantQuerySchema)
      .output(listResponse(eventParticipantSchema)),
    resend: oc
      .route(
        filcRoute({
          auth: true,
          description: "Re-send a guest registration's ticket email, same code",
          method: 'POST',
          operationId: 'postEventsByIdRegistrationsByRegistrationIdTicket',
          path: '/events/{id}/registrations/{registrationId}/ticket',
          tags: EVENT_TAGS,
        })
      )
      .input(eventRegistrationCancelInputSchema)
      .output(deleteResponseSchema),
  },
  /**
   * The organizer's plain numbers: seats, role and status counts, check-ins, the
   * answers per question and the registration timeline.
   */
  stats: oc
    .route(
      filcRoute({
        auth: true,
        description:
          "An event's participant statistics: seats, counts by role and status, check-ins, answers per question and registrations per day",
        method: 'GET',
        operationId: 'getEventsByIdStats',
        path: '/events/{id}/stats',
        tags: EVENT_TAGS,
      })
    )
    .input(eventIdInputSchema)
    .output(eventStatsSchema),
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Update an event',
        method: 'PATCH',
        operationId: 'patchEventsById',
        path: '/events/{id}',
        tags: EVENT_TAGS,
      })
    )
    .input(eventUpdateSchema.extend({ id: z.uuid() }))
    .output(eventItemSchema),
  uploadImage: oc
    .route(
      filcRoute({
        auth: true,
        description: "Upload or replace an event's banner",
        method: 'POST',
        operationId: 'postEventsByIdImage',
        path: '/events/{id}/image',
        tags: EVENT_TAGS,
      })
    )
    .input(eventImageUploadSchema.extend({ id: z.uuid() }))
    .output(eventItemSchema),
};
