import { describe, expect, test } from 'bun:test';
import { renderEventTicket } from './event-ticket';
import type { Branding, EventTicketEmailData } from './types';

const branding: Branding = { appName: 'Filc', appUrl: 'https://filc.hu' };

const data: EventTicketEmailData = {
  code: '6a1f1d38-0f4d-4d1e-9c5b-0f0a3f6e2b11',
  eventDate: 'Wednesday, 20 January 2027',
  eventTitle: 'Open day',
  locale: 'en',
  // A real data URI is long; the shape is what the assertion needs to see.
  qrDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
  ticketUrl: 'https://filc.hu/tickets/6a1f1d38-0f4d-4d1e-9c5b-0f0a3f6e2b11',
  visitorName: 'Anna Parent',
};

describe('event ticket email', () => {
  test('embeds the QR as a data URI', async () => {
    const { html } = await renderEventTicket(data, branding);

    expect(html).toContain(`src="${data.qrDataUri}"`);
    // Inline, so a client renders it from the message and fetches nothing.
    expect(html).not.toContain('cid:');
  });

  test('carries the public ticket link and the bare code', async () => {
    const { html, text } = await renderEventTicket(data, branding);

    // The link appears as the button target and as text in the fallback hint.
    expect(html).toContain(`href="${data.ticketUrl}"`);
    expect(html).toContain(data.ticketUrl.replace(/&/g, '&amp;'));
    // The code is readable text, so a client blocking images still works.
    expect(html).toContain(data.code);
    expect(text).toContain(data.code);
    expect(text).toContain(data.ticketUrl);
  });

  test('shows the event, the date and the visitor, and no account chrome', async () => {
    const { html, subject } = await renderEventTicket(data, branding);

    expect(html).toContain(data.eventTitle);
    expect(html).toContain(data.eventDate);
    expect(html).toContain(data.visitorName);
    expect(subject).toBe(`Your ticket: ${data.eventTitle}`);
    // A guest is not a user: there is no manage/unsubscribe footer.
    expect(html).not.toContain('unsubscribe');
  });

  test('writes the ticket in the recipient locale', async () => {
    const { html, subject } = await renderEventTicket(
      { ...data, locale: 'hu' },
      branding
    );

    expect(subject).toBe(`Jegyed: ${data.eventTitle}`);
    expect(html).toContain('Jegykód');
    expect(html).toContain('Jegy megnyitása');
  });
});
