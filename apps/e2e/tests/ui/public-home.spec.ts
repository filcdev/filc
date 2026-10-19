import { expect, test } from '@playwright/test';

const titlePattern = /Filc/;

test('public timetable home renders the seeded timetable', async ({ page }) => {
  await page.goto('/');

  // Unauthenticated default language (hu): the timetable selector lists the
  // seeded timetable, so the public data pipeline serves it.
  await expect(page).toHaveTitle(titlePattern);
  await expect(
    page.getByRole('button', { name: 'E2E Timetable' })
  ).toBeVisible();
});

test('public health is reachable through the iris proxy', async ({
  request,
}) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
});
