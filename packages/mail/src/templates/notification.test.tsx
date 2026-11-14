import { describe, expect, test } from 'bun:test';
import { renderNotification } from './notification';
import type { Branding, NotificationEmailData } from './types';

const branding: Branding = { appName: 'Filc', appUrl: 'https://filc.hu' };

const base: NotificationEmailData = {
  content: 'The lesson moved to room 12.',
  locale: 'en',
  title: 'Lesson moved',
  typeLabel: 'Lesson moved',
};

const manageUrl = 'https://filc.hu/settings/notifications?channel=email';
const unsubscribeUrl = 'https://filc.hu/unsubscribe?token=abc';

describe('notification email footer', () => {
  test('renders both links when both URLs are supplied', async () => {
    const { html } = await renderNotification(
      { ...base, manageUrl, unsubscribeUrl },
      branding
    );

    expect(html).toContain('Manage your notifications');
    expect(html).toContain(manageUrl);
    expect(html).toContain('Unsubscribe from emails');
    expect(html).toContain(unsubscribeUrl);
  });

  test('omits the manage link when its URL is omitted', async () => {
    const { html } = await renderNotification(
      { ...base, unsubscribeUrl },
      branding
    );

    expect(html).not.toContain('Manage your notifications');
    expect(html).not.toContain(manageUrl);
    expect(html).toContain('Unsubscribe from emails');
  });

  test('omits the unsubscribe link when its URL is omitted', async () => {
    const { html } = await renderNotification({ ...base, manageUrl }, branding);

    expect(html).toContain('Manage your notifications');
    expect(html).not.toContain('Unsubscribe from emails');
    expect(html).not.toContain(unsubscribeUrl);
  });
});
