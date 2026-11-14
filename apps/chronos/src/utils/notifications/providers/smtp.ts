import { createHmac } from 'node:crypto';
import {
  createGraphTransport,
  createMailTransport,
  type EmailAccent,
  type EmailDetail,
  type EntraCredentials,
  GraphMailError,
  type MailTransport,
  renderEmail,
  type SmtpAuth,
} from '@filcdev/mail';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { env } from '#utils/environment';
import { mailLocale } from '#utils/notifications/locale';
import type { NotificationType } from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'smtp']);

const branding = { appName: 'Filc', appUrl: env.baseUrl };

/** Undefined until the first send decides; `null` is a memoised "disabled". */
let transport: MailTransport | null | undefined;

/**
 * The mail app: a dedicated Entra registration when one is configured, the
 * sign-in app otherwise, per field. Both transports mint their token with it —
 * SMTP XOAUTH2 (`SMTP.SendAsApp`) and Graph (`Mail.Send`).
 */
const mailEntra = {
  clientId: env.mailEntraClientId ?? env.entraClientId,
  clientSecret: env.mailEntraClientSecret ?? env.entraClientSecret,
  tenantId: env.mailEntraTenantId ?? env.entraTenantId,
};

function getTransport(): MailTransport | null {
  if (transport !== undefined) {
    return transport;
  }
  transport =
    env.mailTransport === 'graph'
      ? createGraphMailTransport()
      : createSmtpTransport();
  return transport;
}

function createSmtpTransport(): MailTransport | null {
  if (!(env.smtpHost && env.smtpFromEmail)) {
    logger.warn('SMTP not fully configured, email delivery disabled');
    return null;
  }

  if (env.smtpAuth === 'oauth2' && !mailEntra.clientSecret) {
    logger.warn(
      'SMTP OAuth2 needs a client secret: set CHRONOS_MAIL_ENTRA_CLIENT_SECRET (or CHRONOS_ENTRA_CLIENT_SECRET), email delivery disabled',
      { dedicatedApp: Boolean(env.mailEntraClientId) }
    );
    return null;
  }

  let auth: SmtpAuth | undefined;
  if (env.smtpAuth === 'oauth2') {
    logger.debug('SMTP OAuth2 credentials resolved', {
      dedicatedApp: Boolean(env.mailEntraClientId),
    });
    auth = {
      entra: {
        clientId: mailEntra.clientId,
        clientSecret: mailEntra.clientSecret ?? '',
        tenantId: mailEntra.tenantId,
      },
      type: 'oauth2',
      user: env.smtpUser ?? env.smtpFromEmail,
    };
  } else if (env.smtpUser) {
    auth = { pass: env.smtpPass, type: 'basic', user: env.smtpUser };
  }

  try {
    const created = createMailTransport({
      auth,
      from: `"${env.smtpFromName ?? ''}" <${env.smtpFromEmail ?? ''}>`,
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
    });

    logger.info('Mail transport created', {
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      transport: 'smtp',
    });
    return created;
  } catch (error) {
    logger.error('Failed to create SMTP transport', { error });
    return null;
  }
}

function createGraphMailTransport(): MailTransport | null {
  const mailbox = env.graphMailbox ?? env.smtpFromEmail;
  const missing: string[] = [];
  if (!mailbox) {
    missing.push('CHRONOS_GRAPH_MAILBOX (or CHRONOS_SMTP_FROM_EMAIL)');
  }
  for (const [name, value] of [
    [
      'CHRONOS_MAIL_ENTRA_CLIENT_ID (or CHRONOS_ENTRA_CLIENT_ID)',
      mailEntra.clientId,
    ],
    [
      'CHRONOS_MAIL_ENTRA_CLIENT_SECRET (or CHRONOS_ENTRA_CLIENT_SECRET)',
      mailEntra.clientSecret,
    ],
    [
      'CHRONOS_MAIL_ENTRA_TENANT_ID (or CHRONOS_ENTRA_TENANT_ID)',
      mailEntra.tenantId,
    ],
  ] as const) {
    if (!value) {
      missing.push(name);
    }
  }

  if (!mailbox || missing.length > 0) {
    logger.warn(
      'Graph mail transport not configured, email delivery disabled',
      {
        missing,
      }
    );
    return null;
  }

  const entra: EntraCredentials = {
    clientId: mailEntra.clientId,
    clientSecret: mailEntra.clientSecret ?? '',
    tenantId: mailEntra.tenantId,
  };

  try {
    const created = createGraphTransport({
      entra,
      from: `"${env.smtpFromName ?? ''}" <${env.smtpFromEmail ?? mailbox}>`,
      mailbox,
    });

    logger.info('Mail transport created', { mailbox, transport: 'graph' });
    return created;
  } catch (error) {
    logger.error('Failed to create Graph mail transport', { error });
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

/**
 * What a send attempt produced. `retryAfterMs` is set only when a transport
 * was rate limited and told us how long to wait (Graph's 429 `Retry-After`).
 */
export type SendEmailResult = {
  ok: boolean;
  retryAfterMs?: number;
};

/** A rate-limited transport reports how long to wait; anything else does not. */
const retryAfterMsOf = (error: unknown): number | undefined => {
  if (!(error instanceof GraphMailError)) {
    return undefined;
  }
  const { retryAfterMs } = error;
  return typeof retryAfterMs === 'number' &&
    Number.isFinite(retryAfterMs) &&
    retryAfterMs > 0
    ? retryAfterMs
    : undefined;
};

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
): Promise<SendEmailResult> {
  const tp = getTransport();
  if (!tp) {
    logger.debug('Mail transport not available, skipping email to {to}', {
      to,
    });
    return { ok: false };
  }
  try {
    const lang = mailLocale(locale);
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
        // Authenticated, so no token: the page reads the session.
        manageUrl: userId
          ? `${env.baseUrl}/settings/notifications?channel=email`
          : undefined,
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
    return { ok: true };
  } catch (error) {
    const retryAfterMs = retryAfterMsOf(error);
    logger.error('Failed to send email to {to}', {
      error,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
      to,
    });
    return { ok: false, retryAfterMs };
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
  const lang = mailLocale(locale);
  const { html } = await renderEmail(
    'notification',
    {
      accent: typeAccents[type],
      content: body.content,
      details: body.details,
      highlights: body.highlights,
      locale: lang,
      // Sample target so the preview shows the footer's manage link too.
      manageUrl: `${env.baseUrl}/settings/notifications?channel=email`,
      recipientName: lang === 'en' ? 'John Doe' : 'Minta Felhasználó',
      title: body.title,
      typeLabel: typeLabels[type][lang],
    },
    branding
  );
  return html;
}
