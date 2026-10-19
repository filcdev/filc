import { expect, test } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user.json' });

test('substitutions page renders the seeded substitution for the student', async ({
  page,
}) => {
  await page.goto('/subs');

  // The user is signed in (no sign-in card) and the seeded substitution
  // shows up with its substitute teacher.
  await expect(page.getByText('Sign in with Microsoft')).toHaveCount(0);
  await expect(page.getByText('Seeded E2E substitution').first()).toBeVisible();
  await expect(page.getByText('Bence Pótló').first()).toBeVisible();
});
