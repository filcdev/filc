import { gte, lte, type SQL } from 'drizzle-orm';
import { announcement } from '#database/schema/news';

/** How far in advance (days) a future announcement should be visible. */
export const ANNOUNCEMENT_LEAD_DAYS = 7;

/** The text of one stored content block, or null when it carries none. */
function blockText(block: unknown): string | null {
  if (block === null || typeof block !== 'object' || !('content' in block)) {
    return null;
  }

  const { content } = block;
  return typeof content === 'string' && content.length > 0 ? content : null;
}

/**
 * Flatten stored content blocks into the single line a kiosk shows. Mirrors
 * the news panel's rule: string blocks joined by one space, empty ones dropped.
 */
export function flattenAnnouncementContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const lines: string[] = [];
  for (const block of content) {
    const line = blockText(block);
    if (line) {
      lines.push(line);
    }
  }

  return lines.join(' ');
}

/**
 * Conditions restricting announcements to the currently active window: an
 * announcement is live from `ANNOUNCEMENT_LEAD_DAYS` before `validFrom` until
 * `validUntil`. Callers compose these with their own filters.
 */
export function activeAnnouncementConditions(now: Date): SQL[] {
  const leadWindow = new Date(
    now.getTime() + ANNOUNCEMENT_LEAD_DAYS * 24 * 60 * 60 * 1000
  );

  return [
    lte(announcement.validFrom, leadWindow),
    gte(announcement.validUntil, now),
  ];
}
