import { checkInTicketAtDoor } from '#modules/events/checkin';
import {
  deleteCheckinConfig,
  listCheckinConfigs,
  upsertCheckinConfig,
} from '#modules/events/checkin-configs';
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from '#modules/events/events';
import { exportEventRegistrations } from '#modules/events/export';
import { replaceEventFields } from '#modules/events/fields';
import { createGuestRegistration } from '#modules/events/guests';
import {
  deleteEventImage,
  eventImage,
  uploadEventImage,
} from '#modules/events/image';
import { listRegistrations } from '#modules/events/participants';
import {
  cancelRegistration,
  createRegistration,
  decideRegistration,
  resendRegistrationTicket,
  revokeRegistrationCheckinGrant,
} from '#modules/events/registrations';
import {
  createEventRoom,
  deleteEventRoom,
  updateEventRoom,
} from '#modules/events/rooms';
import { listScanEvents } from '#modules/events/scan';
import { getEventStats } from '#modules/events/stats';
import { getTicket } from '#modules/events/tickets';

export const eventsRouter = {
  checkin: checkInTicketAtDoor,
  checkinConfigs: {
    delete: deleteCheckinConfig,
    list: listCheckinConfigs,
    upsert: upsertCheckinConfig,
  },
  create: createEvent,
  delete: deleteEvent,
  deleteImage: deleteEventImage,
  export: exportEventRegistrations,
  fields: { replace: replaceEventFields },
  get: getEvent,
  guests: { create: createGuestRegistration },
  image: eventImage,
  list: listEvents,
  registrations: {
    cancel: cancelRegistration,
    create: createRegistration,
    decide: decideRegistration,
    list: listRegistrations,
    resend: resendRegistrationTicket,
    revokeCheckinGrant: revokeRegistrationCheckinGrant,
  },
  rooms: {
    create: createEventRoom,
    delete: deleteEventRoom,
    update: updateEventRoom,
  },
  scan: listScanEvents,
  stats: getEventStats,
  update: updateEvent,
  uploadImage: uploadEventImage,
};

/**
 * The ticket read is an event artefact but its own contract key, because the
 * scanner phase adds its operations there.
 */
export const ticketsRouter = { get: getTicket };
