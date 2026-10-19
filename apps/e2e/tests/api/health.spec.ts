import { expect, test } from '@playwright/test';

import { chronosUrl } from '../../test-env';

test('health reports database readiness', async ({ request }) => {
  const response = await request.get(`${chronosUrl}/api/health`);

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({
    database: 'up',
    status: 'ok',
  });
});
