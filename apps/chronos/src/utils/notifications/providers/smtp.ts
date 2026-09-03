import { createHmac } from 'node:crypto';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import Handlebars from 'handlebars';
import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { env } from '#utils/environment';
import type { NotificationType } from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'smtp']);

let transporter: Transporter | null = null;

export function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  if (!(env.smtpHost && env.smtpFromEmail)) {
    logger.warn('SMTP not fully configured, email delivery disabled');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      auth: env.smtpUser
        ? {
            pass: env.smtpPass,
            user: env.smtpUser,
          }
        : undefined,
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });

    logger.info('SMTP transporter created', {
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });
    return transporter;
  } catch (error) {
    logger.error('Failed to create SMTP transporter', { error });
    return null;
  }
}

const localized = {
  en: {
    autoMessage: 'This is an automated message from Filc.',
    greeting: 'Dear Filc user,',
    unsubscribeLabel: 'Unsubscribe from notifications',
    viewLabel: 'View in Filc',
  },
  hu: {
    autoMessage: 'Ez az email a Filc rendszer automatikus üzenete.',
    greeting: 'Kedves Filc felhasználó!',
    unsubscribeLabel: 'Leiratkozás az értesítésekről',
    viewLabel: 'Megtekintés a Filcben',
  },
} as const;

type Locale = keyof typeof localized;

function localizedFor(locale: string): (typeof localized)[Locale] {
  return localized[(locale as Locale) in localized ? (locale as Locale) : 'hu'];
}

function typeLabelFor(type: NotificationType, locale: string): string {
  const lang = localizedFor(locale) === localized.en ? 'en' : 'hu';
  return typeLabels[type]?.[lang] ?? type;
}

const typeLabels: Record<NotificationType, { en: string; hu: string }> = {
  announcement: { en: 'Announcement', hu: 'Közlemény' },
  blog_post: { en: 'Blog post', hu: 'Blogbejegyzés' },
  cohort_reselection_required: {
    en: 'Group selection',
    hu: 'Csoportválasztás',
  },
  doorlock_card_used: { en: 'Door lock', hu: 'Ajtózár' },
  moved_lesson: { en: 'Lesson moved', hu: 'Óra áthelyezve' },
  substitution: { en: 'Substitution', hu: 'Helyettesítés' },
  substitution_teacher: {
    en: 'Teacher substitution',
    hu: 'Tanári helyettesítés',
  },
  system_message: { en: 'System message', hu: 'Rendszerüzenet' },
  test: { en: 'Test notification', hu: 'Teszt értesítés' },
};

function buildGreeting(
  name: string | null | undefined,
  locale: string
): string {
  const log = localizedFor(locale);
  const trimmed = name?.trim();
  if (!trimmed) {
    return log.greeting;
  }
  return log === localized.en ? `Dear ${trimmed},` : `Kedves ${trimmed}!`;
}

/**
 * The email is a single shared layout (`layout.hbs`) whose content slot is a
 * plain body partial (`body.hbs`). The message body is always `{{content}}`, so
 * there is no per-type or per-locale template to compile; the locale- and
 * type-specific strings are supplied in the render context instead.
 */
let emailTemplate: HandlebarsTemplateDelegate | null = null;

async function loadEmailTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (emailTemplate) {
    return emailTemplate;
  }
  const [layoutSource, bodySource] = await Promise.all([
    Bun.file(`${import.meta.dir}/templates/layout.hbs`).text(),
    Bun.file(`${import.meta.dir}/templates/body.hbs`).text(),
  ]);
  const layout = Handlebars.compile(layoutSource);
  const body = Handlebars.compile(bodySource);
  emailTemplate = (context) => layout(context, { partials: { content: body } });
  return emailTemplate;
}

export function generateUnsubscribeToken(userId: string): string {
  return createHmac('sha256', env.authSecret).update(userId).digest('hex');
}

export async function sendEmail(
  to: string,
  subject: string,
  type: NotificationType,
  locale: string,
  templateData: Record<string, unknown>,
  userId: string
): Promise<boolean> {
  const tp = getTransporter();
  if (!tp) {
    logger.debug('SMTP not available, skipping email to {to}', { to });
    return false;
  }
  try {
    const unsubscribeToken = generateUnsubscribeToken(userId);
    const log = localizedFor(locale);

    const [recipient] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    const greeting = buildGreeting(recipient?.name, locale);

    const template = await loadEmailTemplate();
    const html = template({
      ...templateData,
      autoMessage: log.autoMessage,
      baseUrl: env.baseUrl,
      greeting,
      lang: log === localized.en ? 'en' : 'hu',
      typeLabel: typeLabelFor(type, locale),
      unsubscribeLabel: log.unsubscribeLabel,
      unsubscribeUrl: `${env.baseUrl}/unsubscribe?userId=${userId}&token=${unsubscribeToken}`,
      viewLabel: log.viewLabel,
    });

    await tp.sendMail({
      from: `"${env.smtpFromName ?? ''}" <${env.smtpFromEmail ?? ''}>`,
      html,
      subject,
      to,
    });

    logger.debug('Email sent to {to} for notification type {type}', {
      to,
      type,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send email to {to}', { error, to });
    return false;
  }
}

/**
 * Render a notification template to HTML without sending it. Used by the
 * dev-only preview endpoint so template styling can be reviewed.
 */
export async function renderEmail(
  type: NotificationType,
  locale: string,
  templateData: Record<string, unknown>
): Promise<string> {
  const log = localizedFor(locale);
  const sampleName = log === localized.en ? 'John Doe' : 'Minta Felhasználó';
  const template = await loadEmailTemplate();
  return template({
    ...templateData,
    autoMessage: log.autoMessage,
    baseUrl: env.baseUrl,
    greeting: buildGreeting(
      (templateData.recipientName as string | undefined) ?? sampleName,
      locale
    ),
    lang: log === localized.en ? 'en' : 'hu',
    typeLabel: typeLabelFor(type, locale),
    unsubscribeLabel: log.unsubscribeLabel,
    unsubscribeUrl: '',
    viewLabel: log.viewLabel,
  });
}
