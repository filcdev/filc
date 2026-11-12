import { createHmac } from 'node:crypto';
import {
  createMailTransport,
  type EmailAccent,
  type EmailDetail,
  type MailTransport,
  renderEmail,
  type SmtpAuth,
} from '@filcdev/mail';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { env } from '#utils/environment';
import type { NotificationType } from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'smtp']);

const branding = { appName: 'Filc', appUrl: env.baseUrl };

let mailer: MailTransport | null = null;

function getMailer(): MailTransport | null {
  if (mailer) {
    return mailer;
  }

  if (!(env.smtpHost && env.smtpFromEmail)) {
    logger.warn('SMTP not fully configured, email delivery disabled');
    return null;
  }

  // A dedicated Entra app keeps the mail-sending role off the app users sign in
  // through; unset, both fall back to the sign-in registration.
  const smtpEntra = {
    clientId: env.smtpEntraClientId ?? env.entraClientId,
    clientSecret: env.smtpEntraClientSecret ?? env.entraClientSecret,
    tenantId: env.smtpEntraTenantId ?? env.entraTenantId,
  };

  if (env.smtpAuth === 'oauth2' && !smtpEntra.clientSecret) {
    logger.warn(
      'SMTP OAuth2 needs a client secret: set CHRONOS_SMTP_ENTRA_CLIENT_SECRET (or CHRONOS_ENTRA_CLIENT_SECRET), email delivery disabled',
      { dedicatedApp: Boolean(env.smtpEntraClientId) }
    );
    return null;
  }

  let auth: SmtpAuth | undefined;
  if (env.smtpAuth === 'oauth2') {
    logger.debug('SMTP OAuth2 credentials resolved', {
      dedicatedApp: Boolean(env.smtpEntraClientId),
    });
    auth = {
      entra: {
        clientId: smtpEntra.clientId,
        clientSecret: smtpEntra.clientSecret ?? '',
        tenantId: smtpEntra.tenantId,
      },
      type: 'oauth2',
      user: env.smtpUser ?? env.smtpFromEmail,
    };
  } else if (env.smtpUser) {
    auth = { pass: env.smtpPass, type: 'basic', user: env.smtpUser };
  }

  try {
    mailer = createMailTransport({
      auth,
      from: `"${env.smtpFromName ?? ''}" <${env.smtpFromEmail ?? ''}>`,
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });

    logger.info('SMTP transport created', {
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });
    return mailer;
  } catch (error) {
    logger.error('Failed to create SMTP transport', { error });
    return null;
  }
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

const typeAccents: Record<NotificationType, EmailAccent> = {
  announcement: 'violet',
  blog_post: 'blue',
  cohort_reselection_required: 'orange',
  doorlock_card_used: 'rose',
  moved_lesson: 'amber',
  substitution: 'teal',
  substitution_teacher: 'indigo',
  system_message: 'slate',
  test: 'teal',
};

export function generateUnsubscribeToken(userId: string): string {
  return createHmac('sha256', env.authSecret).update(userId).digest('hex');
}

export async function sendEmail(
  to: string,
  type: NotificationType,
  locale: string,
  body: {
    content: string;
    details?: EmailDetail[];
    highlights?: string[];
    title: string;
  },
  userId: string
): Promise<boolean> {
  const tp = getMailer();
  if (!tp) {
    logger.debug('SMTP not available, skipping email to {to}', { to });
    return false;
  }
  try {
    const lang = locale === 'en' ? 'en' : 'hu';
    // The id is a uuid column: the pure SMTP delivery test passes an empty id,
    // and querying with it would abort the whole send.
    const [recipient] = userId
      ? await db
          .select({ name: userTable.name })
          .from(userTable)
          .where(eq(userTable.id, userId))
          .limit(1)
      : [];

    const rendered = await renderEmail(
      'notification',
      {
        accent: typeAccents[type],
        content: body.content,
        details: body.details,
        highlights: body.highlights,
        locale: lang,
        recipientName: recipient?.name,
        title: body.title,
        typeLabel: typeLabels[type][lang],
        // A pure SMTP delivery test has no user behind it to unsubscribe.
        unsubscribeUrl: userId
          ? `${env.baseUrl}/unsubscribe?userId=${userId}&token=${generateUnsubscribeToken(
              userId
            )}`
          : undefined,
      },
      branding
    );

    await tp.send({ ...rendered, to });

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
 * Render a notification email to HTML without sending it. Used by the
 * dev-only preview endpoint so template styling can be reviewed.
 */
export async function renderPreviewEmail(
  type: NotificationType,
  locale: string,
  body: {
    content: string;
    details?: EmailDetail[];
    highlights?: string[];
    title: string;
  }
): Promise<string> {
  const lang = locale === 'en' ? 'en' : 'hu';
  const { html } = await renderEmail(
    'notification',
    {
      accent: typeAccents[type],
      content: body.content,
      details: body.details,
      highlights: body.highlights,
      locale: lang,
      recipientName: lang === 'en' ? 'John Doe' : 'Minta Felhasználó',
      title: body.title,
      typeLabel: typeLabels[type][lang],
    },
    branding
  );
  return html;
}
