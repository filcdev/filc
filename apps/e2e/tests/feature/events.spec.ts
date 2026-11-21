import { type APIRequestContext, expect, test } from '@playwright/test';

import { chronosUrl } from '../../test-env';

/**
 * The events smoke: an organizer publishes an event with one question, a
 * student signs up through it, the organizer's export answers a CSV, and a
 * visitor's second signup with the same address answers 409.
 *
 * The suite's seed (`db:seed:test`) truncates the events tables, so every run
 * starts from zero; each test still creates its own event, because the file is
 * rerun on its own while debugging.
 */

const EVENTS_URL = `${chronosUrl}/api/events`;

/** The shape of a ticket id (a uuid), so the test does not pin a value. */
const UUID_PATTERN = /^[0-9a-f-]{36}$/;

/** Minutes from now, as the ISO string the API's date fields accept. */
const fromNow = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();

/** A published, open event that takes students and guests. */
const createEvent = async (
  request: APIRequestContext
): Promise<{ id: string }> => {
  const response = await request.post(EVENTS_URL, {
    data: {
      capacity: 2,
      category: 'open_day',
      cohortIds: [],
      description: [],
      endsAt: fromNow(120),
      guestRegistrationEnabled: true,
      registrationEnabled: true,
      startsAt: fromNow(60),
      status: 'published',
      title: `E2E event ${new Date().toISOString()}`,
    },
  });

  expect(response.status()).toBe(201);
  return response.json();
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test('a student registers for a published event and the export answers a CSV', async ({
  playwright,
  request,
}) => {
  const event = await createEvent(request);

  const question = await request.put(`${EVENTS_URL}/${event.id}/fields`, {
    data: {
      fields: [
        {
          appliesTo: 'both',
          label: 'Why are you coming?',
          position: 0,
          required: true,
          type: 'text',
        },
      ],
      id: event.id,
    },
  });
  expect(question.status()).toBe(200);
  const [field] = (await question.json()).items;
  expect(field.label).toBe('Why are you coming?');

  // The seeded student, not the organizer: a second session in the same test.
  const student = await playwright.request.newContext({
    storageState: 'playwright/.auth/user.json',
  });
  try {
    const registered = await student.post(
      `${EVENTS_URL}/${event.id}/registrations`,
      { data: { answers: [{ fieldId: field.id, value: 'E2E answer' }] } }
    );
    expect(registered.status()).toBe(200);
    const registration = await registered.json();
    expect(registration.status).toBe('confirmed');
    expect(registration.role).toBe('participant');
    expect(registration.answers).toEqual([
      { fieldId: field.id, value: 'E2E answer' },
    ]);

    // One seat of two taken, and the answer reads back on the caller's own row.
    const detail = await student.get(`${EVENTS_URL}/${event.id}`);
    expect(detail.status()).toBe(200);
    const body = await detail.json();
    expect(body.seats).toEqual({ capacity: 2, remaining: 1, taken: 1 });
    expect(body.myRegistration.answers[0].value).toBe('E2E answer');
  } finally {
    await student.dispose();
  }

  const exported = await request.get(`${EVENTS_URL}/${event.id}/export`);
  expect(exported.status()).toBe(200);
  expect(exported.headers()['content-type']).toContain('text/csv');
  // Read as bytes: `Blob.text()` would strip the BOM the file is supposed to
  // carry, so only the first character proves it is there.
  const csv = Buffer.from(await exported.body()).toString('utf8');
  expect(csv.startsWith('\ufeff')).toBe(true);
  // `toCsv` joins rows with a bare LF, so the first line is the header.
  const [header, firstRow] = csv.slice(1).split('\n');
  expect(header).toBe(
    'name,email,class,role,status,registered_at,checked_in_at,Why are you coming?'
  );
  expect(firstRow).toContain('E2E Student,e2e-user@e2e.filc,9.A,participant');
  expect(firstRow).toContain('E2E answer');
});

test('guest signup answers 409 on a duplicate email', async ({
  playwright,
  request,
}) => {
  const event = await createEvent(request);

  // A visitor has no account: an explicitly empty session, because the file's
  // storage state would otherwise make this an organizer's request.
  const guest = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  try {
    const body = { email: 'e2e-guardian@example.test', name: 'E2E Guardian' };

    const first = await guest.post(`${EVENTS_URL}/${event.id}/guests`, {
      data: body,
    });
    expect(first.status()).toBe(201);
    const ticket = await first.json();
    expect(ticket.code).toMatch(UUID_PATTERN);

    // One address per event, whether or not the row is confirmed: the second
    // signup is the conflict, not a second ticket.
    const duplicate = await guest.post(`${EVENTS_URL}/${event.id}/guests`, {
      data: body,
    });
    expect(duplicate.status()).toBe(409);
    expect((await duplicate.json()).code).toBe('CONFLICT');
  } finally {
    await guest.dispose();
  }
});
