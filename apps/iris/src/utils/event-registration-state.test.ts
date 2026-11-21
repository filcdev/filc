import { describe, expect, it } from 'bun:test';
import {
  type EventRegistrationInput,
  eventRegistrationInfo,
  formatEventDateRange,
} from './event-registration-state';

/**
 * Returns the key plus its interpolation values, sorted by name so a test can
 * read which key was chosen and what it was given.
 */
const t = (key: string, options?: Record<string, string>) =>
  options
    ? `${key} {${Object.keys(options)
        .sort()
        .map((name) => `${name}=${options[name]}`)
        .join(', ')}}`
    : key;

const now = new Date('2026-11-10T12:00:00Z');

function info(event: Partial<EventRegistrationInput> = {}) {
  return eventRegistrationInfo(
    {
      registrationClosesAt: null,
      registrationEnabled: true,
      registrationOpensAt: null,
      ...event,
    },
    { language: 'hu', now, t }
  );
}

describe('formatEventDateRange', () => {
  it('shows the start with its time and only the clock for a one-day event', () => {
    expect(
      formatEventDateRange('2026-11-19T13:00:00Z', '2026-11-19T16:00:00Z', 'hu')
    ).toBe('2026. nov. 19. 14:00 – 17:00');
  });

  it('keeps both dates when the event runs past its first day', () => {
    expect(
      formatEventDateRange('2026-11-01T07:00:00Z', '2026-11-03T17:00:00Z', 'hu')
    ).toBe('2026. nov. 1. 8:00 – 2026. nov. 3. 18:00');
  });
});

describe('eventRegistrationInfo', () => {
  it('reports a switched-off event as off, whatever its window says', () => {
    const result = info({
      registrationClosesAt: '2026-11-20T07:00:00Z',
      registrationEnabled: false,
      registrationOpensAt: '2026-11-18T07:00:00Z',
    });

    expect(result.state).toBe('off');
    expect(result.status).toBe('events.public.registration.status.off');
    expect(result.range).toBeNull();
    expect(result.label).toBe('events.public.registration.line.off');
  });

  it('reports a window that has not opened yet, with the opening moment', () => {
    const result = info({
      registrationClosesAt: '2026-11-20T19:00:00Z',
      registrationOpensAt: '2026-11-18T07:00:00Z',
    });

    expect(result.state).toBe('opens_later');
    expect(result.status).toBe('events.public.registration.status.opens_later');
    expect(result.range).toBe(
      'events.public.registration.range.both {endsAt=2026. nov. 20. 20:00, startsAt=2026. nov. 18. 8:00}'
    );
    expect(result.label).toContain(
      'events.public.registration.line.opensLater'
    );
    expect(result.label).toContain(result.range ?? '');
  });

  it('shows only the opening moment when no close date is set', () => {
    const result = info({ registrationOpensAt: '2026-11-18T07:00:00Z' });

    expect(result.state).toBe('opens_later');
    expect(result.range).toBe('2026. nov. 18. 8:00');
  });

  it('reports a window whose close date has passed as closed', () => {
    const result = info({
      registrationClosesAt: '2026-11-01T19:00:00Z',
      registrationOpensAt: '2026-10-01T07:00:00Z',
    });

    expect(result.state).toBe('closed');
    expect(result.status).toBe('events.public.registration.status.closed');
    expect(result.range).toBe(
      'events.public.registration.range.both {endsAt=2026. nov. 1. 20:00, startsAt=2026. okt. 1. 9:00}'
    );
    expect(result.label).toContain(
      'events.public.registration.line.closedRange'
    );
  });

  it('reports a window that is open now, with the whole range', () => {
    const result = info({
      registrationClosesAt: '2026-11-18T19:00:00Z',
      registrationOpensAt: '2026-11-01T07:00:00Z',
    });

    expect(result.state).toBe('open');
    expect(result.status).toBe('events.public.registration.status.open');
    expect(result.range).toBe(
      'events.public.registration.range.both {endsAt=2026. nov. 18. 20:00, startsAt=2026. nov. 1. 8:00}'
    );
    expect(result.label).toContain('events.public.registration.line.openRange');
  });

  it('reads a close-only window as a deadline', () => {
    const result = info({ registrationClosesAt: '2026-11-18T19:00:00Z' });

    expect(result.state).toBe('open');
    expect(result.range).toBe(
      'events.public.registration.range.until {endsAt=2026. nov. 18. 20:00}'
    );
  });

  it('reads an open-only window as the moment registration started', () => {
    const result = info({ registrationOpensAt: '2026-11-01T07:00:00Z' });

    expect(result.state).toBe('open');
    expect(result.range).toBe(
      'events.public.registration.range.from {startsAt=2026. nov. 1. 8:00}'
    );
  });

  it('says an unbounded window is open, with no range', () => {
    const result = info();

    expect(result.state).toBe('open');
    expect(result.range).toBeNull();
    expect(result.label).toBe('events.public.registration.line.open');
  });

  it('keeps an inconsistent window in the earlier state', () => {
    const result = info({
      registrationClosesAt: '2026-11-01T19:00:00Z',
      registrationOpensAt: '2026-11-18T07:00:00Z',
    });

    expect(result.state).toBe('opens_later');
  });

  it('treats the exact boundary as open', () => {
    expect(info({ registrationOpensAt: now.toISOString() }).state).toBe('open');
    expect(info({ registrationClosesAt: now.toISOString() }).state).toBe(
      'open'
    );
  });
});
