import { createHmac } from 'node:crypto';
import { getLogger } from '@logtape/logtape';
import Handlebars from 'handlebars';
import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';
import { env } from '#utils/environment';
import type { NotificationType } from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'smtp']);

let transporter: Transporter | null = null;

export function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  if (!env.smtpHost || env.smtpHost === 'localhost') {
    logger.warn('SMTP host not configured, email delivery disabled');
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

const templateCache: Record<string, HandlebarsTemplateDelegate> = {};

async function loadTemplate(
  locale: string,
  type: NotificationType
): Promise<HandlebarsTemplateDelegate> {
  const cacheKey = `${locale}/${type}`;
  const existing = templateCache[cacheKey];
  if (existing) {
    return existing;
  }

  const templatePath = `${import.meta.dir}/templates/${locale}/${type}.hbs`;
  const fallback = '{{title}}: {{content}}';
  let source: string;

  try {
    source = await Bun.file(templatePath).text();
  } catch {
    logger.warn(`Template not found: ${cacheKey}, using fallback`);
    source = fallback;
  }

  const template = Handlebars.compile(source);
  templateCache[cacheKey] = template;
  return template;
}

export function generateUnsubscribeToken(userId: string): string {
  return createHmac('sha256', env.authSecret).update(userId).digest('hex');
}

export async function sendEmail(
  to: string,
  subject: string,
  type: NotificationType,
  locale: string,
  templateData: Record<string, unknown>
): Promise<boolean> {
  const tp = getTransporter();
  if (!tp) {
    logger.debug('SMTP not available, skipping email to {to}', { to });
    return false;
  }

  try {
    const unsubscribeToken = generateUnsubscribeToken(to);
    const unsubscribeUrl = `${env.baseUrl}/unsubscribe?token=${unsubscribeToken}`;

    const template = await loadTemplate(locale, type);
    const html = template({
      ...templateData,
      baseUrl: env.baseUrl,
      typeLabel: type,
      unsubscribeUrl,
    });

    await tp.sendMail({
      from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
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
