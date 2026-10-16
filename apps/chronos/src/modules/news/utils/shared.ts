import { user } from '#database/schema/authentication';
import { announcement } from '#modules/news/schema';

/** Shared `author` projection used by announcement/system-message list & detail. */
export const authorSelect = {
  id: user.id,
  image: user.image,
  name: user.name,
};

/**
 * Shared column projection for announcement list & detail, so a new column
 * cannot be forgotten in one of the hand-written selects. Spread the author
 * projection next to it: `{ ...announcementSelect, author: authorSelect }`.
 */
export const announcementSelect = {
  authorId: announcement.authorId,
  content: announcement.content,
  createdAt: announcement.createdAt,
  highlighted: announcement.highlighted,
  id: announcement.id,
  imageByteSize: announcement.imageByteSize,
  imageContentType: announcement.imageContentType,
  imageKey: announcement.imageKey,
  imageUpdatedAt: announcement.imageUpdatedAt,
  kioskOnly: announcement.kioskOnly,
  title: announcement.title,
  updatedAt: announcement.updatedAt,
  validFrom: announcement.validFrom,
  validUntil: announcement.validUntil,
};

export const resolveTitle = (title: string | null | undefined): string =>
  title && title.length > 0 ? title : 'Untitled';
