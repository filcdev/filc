import type { Page, Playwright } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { irisUrl } from '../../test-env';

/**
 * The seasonal skin, the visitor's own palette and the opt-out between them.
 *
 * Two things here are deliberate: the assertions on the *server* HTML (a
 * refusal has to be honoured in the first paint, not after hydration), and the
 * chip colour check, which fails if Tailwind ever stops emitting the
 * `bg-[var(--class-N)]` utilities — the failure mode that ships invisible chips
 * rather than a broken build.
 */

const ADMIN = 'playwright/.auth/admin.json';
const USER = 'playwright/.auth/user.json';

/** Act as the seeded admin, whatever session the test itself is using. */
const asAdmin = (playwright: Playwright) =>
  playwright.request.newContext({ baseURL: irisUrl, storageState: ADMIN });

const setSkin = async (playwright: Playwright, theme: string) => {
  const admin = await asAdmin(playwright);
  const response = await admin.patch('/api/theme', { data: { theme } });
  expect(response.ok(), `setting the site theme to ${theme}`).toBeTruthy();
  await admin.dispose();
};

/** The subject colour the first slot resolves to, on the document root. */
const classSlotOne = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--class-1')
      .trim()
  );

/**
 * Whether any loaded stylesheet paints with `--class-1`. A subject chip is
 * `bg-[var(--class-N)]`, an arbitrary-value utility that Tailwind has to find
 * in the source; when the scan misses it the class is simply not emitted and
 * every chip renders transparent — a bug no typecheck or build can catch.
 */
const chipUtilityExists = (page: Page) =>
  page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet: not ours
      }
      for (const rule of rules) {
        const text = rule.cssText;
        if (
          text.includes('background-color') &&
          text.includes('var(--class-1)')
        ) {
          return true;
        }
      }
    }
    return false;
  });

test.describe('the seasonal skin', () => {
  test.afterEach(async ({ playwright }) => {
    // The seeded database is shared by the whole suite; leave it as found.
    await setSkin(playwright, 'default');
  });

  test('paints a signed-out visitor’s first paint', async ({
    page,
    playwright,
  }) => {
    await setSkin(playwright, 'christmas');

    // The response, not the DOM: the attribute has to be in the markup or the
    // skin arrives after hydration and the page flashes the everyday palette.
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('data-site-theme="christmas"');

    await page.goto('/');
    // The motifs are the seasonal layer; `default` renders none of them.
    await expect(
      page.locator('div.fixed[aria-hidden="true"] span')
    ).not.toHaveCount(0);
  });
});

test.describe('a signed-in visitor', () => {
  test.use({ storageState: USER });

  test.beforeEach(async ({ page }) => {
    // Known starting point: the skin may paint, and nothing is acknowledged.
    await page.request.patch('/api/notifications/settings', {
      data: { siteThemeAcknowledged: null, siteThemeEnabled: true },
    });
  });

  test.afterEach(async ({ page, playwright }) => {
    await setSkin(playwright, 'default');
    await page.request.patch('/api/notifications/settings', {
      data: {
        colorScheme: 'default',
        siteThemeAcknowledged: null,
        siteThemeEnabled: true,
      },
    });
  });

  test('is told once, and can turn the skin off for good', async ({
    page,
    playwright,
  }) => {
    await setSkin(playwright, 'christmas');
    await page.goto('/');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Christmas');
    await expect(page.locator('html')).toHaveAttribute(
      'data-site-theme',
      'christmas'
    );

    await dialog
      .getByRole('button', { name: "Don't turn it on for me" })
      .click();

    // The skin is withdrawn live, and the refusal is stored: the next server
    // render already carries `default`, so it never flashes again.
    await expect(page.locator('html')).toHaveAttribute(
      'data-site-theme',
      'default'
    );
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('data-site-theme="default"');

    // Told once per skin: no second dialog for the same one.
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('sees the timetable’s subject colours follow their palette', async ({
    page,
    playwright,
  }) => {
    await setSkin(playwright, 'default');
    await page.goto('/');

    const before = await classSlotOne(page);
    expect(
      before,
      'the subject colours are declared by the design system'
    ).not.toBe('');
    expect(await chipUtilityExists(page), 'a chip utility is emitted').toBe(
      true
    );

    await page.request.patch('/api/notifications/settings', {
      data: { colorScheme: 'nord' },
    });
    await page.reload();

    // Same slot, different tint: the chip follows the palette instead of being
    // a hardcoded rainbow.
    expect(await classSlotOne(page)).not.toBe(before);
  });
});

test.describe('the appearance picker', () => {
  test.use({ storageState: ADMIN });

  test.beforeEach(async ({ page }) => {
    await page.request.patch('/api/theme', { data: { theme: 'default' } });
  });

  test('shows one card per skin, in the contract’s order', async ({ page }) => {
    await page.goto('/admin/theme');

    // One card per id in `siteThemeIds`, and the order is that list's — the
    // picker derives from the contract, so a new skin cannot go missing here.
    const cards = page.locator('button[aria-pressed]');
    await expect(cards).toHaveCount(8);
    await expect(cards.first()).toContainText('Default');
    await expect(cards.last()).toContainText('Christmas');

    // The active skin is announced, not only ringed.
    await expect(cards.first()).toHaveAttribute('aria-pressed', 'true');
  });
});
