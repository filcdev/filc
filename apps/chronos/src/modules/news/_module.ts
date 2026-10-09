import type { Module } from '#modules/module';
import { newsNotifications } from '#modules/news/_notifications';

/** News: announcements, blog posts, system notices — and their notifications. */
export const newsModule = {
  notifications: newsNotifications,
} satisfies Module;
