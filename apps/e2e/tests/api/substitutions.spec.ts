import { type APIRequestContext, expect, test } from '@playwright/test';

import { chronosUrl } from '../../test-env';

test.use({ storageState: 'playwright/.auth/admin.json' });

const SUBSTITUTIONS_URL = `${chronosUrl}/api/timetable/substitutions`;

const createSubstitution = async (
  request: APIRequestContext,
  body: Record<string, unknown>
) => request.post(SUBSTITUTIONS_URL, { data: body });

test('substitution CRUD lifecycle', async ({ request }) => {
  const created = await createSubstitution(request, {
    comment: 'e2e create',
    date: new Date().toISOString().slice(0, 10),
    lessonIds: ['00000000-0000-4000-8000-0000000000e1'],
    substituter: '60000000-0000-4000-8000-000000000002',
  });

  expect(created.status()).toBe(200);
  const body = await created.json();
  const { id } = body;
  expect(body.comment).toBe('e2e create');
  expect(body.substituter).toBe('60000000-0000-4000-8000-000000000002');

  const list = await request.get(SUBSTITUTIONS_URL);
  const items = (await list.json()).items;
  expect(
    items.some(
      (item: { substitution: { id: string } }) => item.substitution.id === id
    )
  ).toBe(true);

  const updated = await request.put(`${SUBSTITUTIONS_URL}/${id}`, {
    data: {
      comment: 'e2e updated',
      lessonIds: null,
      substituter: null,
    },
  });
  expect(updated.status()).toBe(200);
  const updatedBody = await updated.json();
  expect(updatedBody.comment).toBe('e2e updated');
  expect(updatedBody.substituter).toBeNull();

  const deleted = await request.delete(`${SUBSTITUTIONS_URL}/${id}`);
  expect(deleted.status()).toBe(200);

  const finalList = await request.get(SUBSTITUTIONS_URL);
  const finalItems = (await finalList.json()).items;
  expect(
    finalItems.some(
      (item: { substitution: { id: string } }) => item.substitution.id === id
    )
  ).toBe(false);
});

test('guarded substitution create rejects anonymous callers', async ({
  playwright,
}) => {
  // Fresh browserless context; `newContext` inherits the project's
  // `storageState` by default, so give it an explicit empty one.
  const request = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const response = await request.post(SUBSTITUTIONS_URL, {
    data: {
      comment: null,
      date: new Date().toISOString().slice(0, 10),
      lessonIds: ['00000000-0000-4000-8000-0000000000e1'],
    },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.code).toBe('UNAUTHORIZED');
  await request.dispose();
});
