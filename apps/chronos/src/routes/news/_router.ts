import { newsFactory } from '#routes/news/_factory';
import {
  createAnnouncement,
  deleteAnnouncement,
  deleteAnnouncementImage,
  getAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '#routes/news/announcements';
import {
  createBlog,
  deleteBlog,
  getBlogById,
  getBlogBySlug,
  listDrafts,
  listPublishedBlogs,
  publishBlog,
  unpublishBlog,
  updateBlog,
} from '#routes/news/blogs';
import {
  createSystemMessage,
  deleteSystemMessage,
  getSystemMessage,
  listSystemMessages,
  updateSystemMessage,
} from '#routes/news/system-messages';

const announcementsRouter = newsFactory
  .createApp()
  .get('/', ...listAnnouncements)
  .get('/:id', ...getAnnouncement)
  .post('/:id/image', ...uploadAnnouncementImage)
  .delete('/:id/image', ...deleteAnnouncementImage)
  .post('/', ...createAnnouncement)
  .patch('/:id', ...updateAnnouncement)
  .delete('/:id', ...deleteAnnouncement);

const systemMessagesRouter = newsFactory
  .createApp()
  .get('/', ...listSystemMessages)
  .get('/:id', ...getSystemMessage)
  .post('/', ...createSystemMessage)
  .patch('/:id', ...updateSystemMessage)
  .delete('/:id', ...deleteSystemMessage);

const blogsRouter = newsFactory
  .createApp()
  .get('/', ...listPublishedBlogs)
  .get('/drafts', ...listDrafts)
  .get('/id/:id', ...getBlogById)
  .get('/:slug', ...getBlogBySlug)
  .post('/', ...createBlog)
  .patch('/:id', ...updateBlog)
  .post('/:id/publish', ...publishBlog)
  .post('/:id/unpublish', ...unpublishBlog)
  .delete('/:id', ...deleteBlog);

export const newsRouter = newsFactory
  .createApp()
  .route('/announcements', announcementsRouter)
  .route('/system-messages', systemMessagesRouter)
  .route('/blogs', blogsRouter);
