import { announcementFactory } from '#routes/announcement/_factory';
import { listAnnouncements } from '#routes/announcement/index';

export const announcementRouter = announcementFactory
  .createApp()
  .get('/', ...listAnnouncements);
