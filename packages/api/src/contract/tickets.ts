import { oc } from '@orpc/contract';
import {
  eventTicketInputSchema,
  eventTicketSchema,
} from '../domains/events/guest';
import { filcRoute } from './route';

/**
 * The public ticket read. Its own contract because the door and the scanner
 * phases will add their own operations here, and because the ticket is the one
 * event artefact a guest can open without an account.
 */
export const ticketsContract = {
  get: oc
    .route(
      filcRoute({
        description:
          'Read a ticket by its code: event, date, visitor name and check-in state; nothing else',
        method: 'GET',
        operationId: 'getTicketsByTicketId',
        path: '/tickets/{ticketId}',
        tags: ['Events'],
      })
    )
    .input(eventTicketInputSchema)
    .output(eventTicketSchema),
};
