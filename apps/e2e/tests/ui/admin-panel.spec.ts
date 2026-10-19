import { expect, test } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('admin panel loads for an admin session', async ({ page }) => {
  await page.goto('/admin');

  // AdminSidebar section labels; asserted as behavior, not markup.
  await expect(
    page.getByRole('button', { name: 'Manage Timetables' })
  ).toBeVisible();
  await expect(page.getByText('Communications')).toBeVisible();
});
