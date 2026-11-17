import { describe, expect, test } from 'bun:test';
import { createTranslator } from '@filcdev/i18n';
import { EmailLayout } from './email-layout';
import { renderNotification } from './notification';
import { renderEmailElement } from './render';
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

/** Every `<p>` react-email rendered, with its attributes and its text. */
const paragraphsOf = (html: string): { attrs: string; text: string }[] =>
  [...html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map(([, attrs, text]) => ({
    attrs: attrs ?? '',
    text: (text ?? '').trim(),
  }));

const paragraphWithText = (html: string, text: string) =>
  paragraphsOf(html).find((paragraph) => paragraph.text === text);

/** The body paragraphs carry `textStyle`; nothing else in the card uses that margin. */
const BODY_PARAGRAPH_STYLE = 'margin:0 0 16px';
/** The hero lead carries `heroLeadStyle`'s 18px size. */
const HERO_LEAD_STYLE = 'font-size:18px';

const countOf = (html: string, text: string): number =>
  (html.match(new RegExp(`>\\s*${text}\\s*<`, 'g')) ?? []).length;

describe('notification email content', () => {
  test('renders the first paragraph as the hero lead and the rest as body', async () => {
    const { html } = await renderNotification(
      {
        ...base,
        content: 'Lead line.\n\nSecond line.\n\nThird line.',
      },
      branding
    );

    expect(paragraphWithText(html, 'Lead line.')?.attrs).toContain(
      HERO_LEAD_STYLE
    );
    expect(paragraphWithText(html, 'Second line.')?.attrs).toContain(
      BODY_PARAGRAPH_STYLE
    );
    expect(paragraphWithText(html, 'Third line.')?.attrs).toContain(
      BODY_PARAGRAPH_STYLE
    );
    // The lead is rendered once, in the hero, not again among the body.
    expect(countOf(html, 'Lead line.')).toBe(1);
  });

  test('renders neither a lead nor body paragraphs for empty content', async () => {
    const { html } = await renderNotification(
      { ...base, content: '   \n\n  ' },
      branding
    );

    expect(html).not.toContain(HERO_LEAD_STYLE);
    expect(html).not.toContain(BODY_PARAGRAPH_STYLE);
  });

  test('deduplicates and caps the highlights at four', async () => {
    const { html } = await renderNotification(
      {
        ...base,
        highlights: [
          'One',
          'Two',
          'One',
          '  ',
          ' Two ',
          'Three',
          'Four',
          'Five',
        ],
      },
      branding
    );

    expect(countOf(html, 'One')).toBe(1);
    expect(countOf(html, 'Two')).toBe(1);
    expect(countOf(html, 'Three')).toBe(1);
    expect(countOf(html, 'Four')).toBe(1);
    // The cap is applied after deduplication, so the fifth distinct value is out.
    expect(html).not.toContain('Five');
  });

  test('renders label/value rows and tolerates a repeated label', async () => {
    const { html } = await renderNotification(
      {
        ...base,
        details: [
          { label: 'Room', value: '201' },
          { label: 'Room', value: '202' },
        ],
      },
      branding
    );

    expect(countOf(html, 'Room')).toBe(2);
    expect(html).toContain('201');
    expect(html).toContain('202');
  });

  test('renders the hu copy for the hu locale', async () => {
    const { html } = await renderNotification(
      { ...base, locale: 'hu', manageUrl, unsubscribeUrl },
      branding
    );

    expect(html).toContain('Kedves Filc felhasználó!');
    expect(html).toContain('Értesítések kezelése');
    expect(html).toContain('Leiratkozás az e-mailekről');
    expect(html).toContain('Megtekintés a Filcben');
    expect(html).not.toContain('Manage your notifications');
  });

  test('renders the named hu greeting with a literal name', async () => {
    const { html } = await renderNotification(
      { ...base, locale: 'hu', recipientName: 'Minta $& Felhasználó' },
      branding
    );

    // `$&` is a replacement pattern; a name has to survive it unchanged.
    expect(html).toContain('Kedves Minta $&amp; Felhasználó!');
  });

  test('renders a non-empty plain-text alternative', async () => {
    const { text } = await renderNotification(
      { ...base, content: 'Lead line.\n\nSecond line.', details: [] },
      branding
    );

    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).toContain('Lead line.');
    expect(text).toContain('Second line.');
  });
});

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

  test('separates the two links with a middle dot', async () => {
    const { html } = await renderNotification(
      { ...base, manageUrl, unsubscribeUrl },
      branding
    );

    expect(html).toContain(' · ');
  });

  test('omits the manage link when its URL is omitted', async () => {
    const { html } = await renderNotification(
      { ...base, unsubscribeUrl },
      branding
    );

    expect(html).not.toContain('Manage your notifications');
    expect(html).not.toContain(manageUrl);
    expect(html).toContain('Unsubscribe from emails');
    // The separator only joins two links; a lone link has nothing to separate.
    expect(html).not.toContain(' · ');
  });

  test('omits the unsubscribe link when its URL is omitted', async () => {
    const { html } = await renderNotification({ ...base, manageUrl }, branding);

    expect(html).toContain('Manage your notifications');
    expect(html).not.toContain('Unsubscribe from emails');
    expect(html).not.toContain(unsubscribeUrl);
    expect(html).not.toContain(' · ');
  });
});

const COPY_TYPES = [
  'substitution',
  'substitution_teacher',
  'moved_lesson',
  'moved_lesson_teacher',
  'announcement',
  'system_message',
] as const;

type CopyType = (typeof COPY_TYPES)[number];

/** The two teacher-facing mails drop the teacher row: the recipient is the teacher. */
const TEACHER_TYPES: ReadonlySet<CopyType> = new Set([
  'substitution_teacher',
  'moved_lesson_teacher',
]);

/** The body copy of a type, built from the catalogue the way a handler builds it. */
const contentFor = (
  t: ReturnType<typeof createTranslator>,
  type: CopyType
): string => {
  const content: Record<CopyType, string> = {
    announcement: t('announcement.content', {
      prefix: t('announcement.prefix'),
      title: 'School trip',
    }),
    moved_lesson: t('movedLesson.body', { location: '201' }),
    moved_lesson_teacher: t('movedLesson.teacherBody'),
    substitution: t('substitution.newSubstitution', { date: '2026-11-17' }),
    substitution_teacher: t('substitution.teacherIntro'),
    system_message: t('systemMessage.content', {
      prefix: t('systemMessage.prefix'),
      title: 'Maintenance',
    }),
  };
  return content[type];
};

describe('notification email types', () => {
  for (const locale of ['en', 'hu'] as const) {
    describe(locale, () => {
      const t = createTranslator(locale);
      // Literal expectations, so a drifted key fails here rather than silently
      // moving both the payload and the assertion together.
      const expected =
        locale === 'en'
          ? {
              greeting: 'Dear Filc user,',
              labels: ['Date', 'Class', 'Room'],
              teacher: 'Teacher',
            }
          : {
              greeting: 'Kedves Filc felhasználó!',
              labels: ['Dátum', 'Osztály', 'Terem'],
              teacher: 'Tanár',
            };
      const label = {
        class: t('labels.class'),
        date: t('labels.date'),
        room: t('labels.room'),
        teacher: t('labels.teacher'),
      };

      for (const type of COPY_TYPES) {
        test(`renders ${type} with its greeting and direct labels`, async () => {
          const details = [
            { label: label.date, value: '2026-11-17' },
            { label: label.class, value: '12A' },
            { label: label.room, value: '201' },
            ...(TEACHER_TYPES.has(type)
              ? []
              : [{ label: label.teacher, value: 'Kiss Anna' }]),
          ];
          const { html } = await renderNotification(
            {
              content: contentFor(t, type),
              details,
              locale,
              title: t(`types.${type}`),
              typeLabel: t(`types.${type}`),
            },
            branding
          );

          expect(html).toContain(expected.greeting);
          for (const direct of expected.labels) {
            expect(html).toContain(direct);
          }
          expect(countOf(html, expected.teacher)).toBe(
            TEACHER_TYPES.has(type) ? 0 : 1
          );
        });
      }
    });
  }
});

describe('EmailLayout', () => {
  const render = (lang: 'en' | 'hu'): Promise<{ html: string }> =>
    renderEmailElement(
      <EmailLayout
        appName={branding.appName}
        lang={lang}
        manageUrl={manageUrl}
        preview="Preview line"
        title="Layout title"
        typeLabel="Type"
        unsubscribeUrl={unsubscribeUrl}
      >
        <p>Child content</p>
      </EmailLayout>,
      'Layout title'
    );

  test('renders the brand, the title and the children', async () => {
    const { html } = await render('en');

    expect(html).toContain('FILC');
    expect(html).toContain(branding.appName);
    expect(html).toContain('Layout title');
    expect(html).toContain('Child content');
    expect(html).toContain('This is an automated message from Filc.');
  });

  test('sets the document language from the locale', async () => {
    const { html } = await render('hu');

    expect(html).toContain('lang="hu"');
    expect(html).toContain('Ez az email a Filc rendszer automatikus üzenete.');
  });
});
