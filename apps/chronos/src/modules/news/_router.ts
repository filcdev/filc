import {
  createAnnouncement,
  deleteAnnouncement,
  deleteAnnouncementImage,
  getAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '#modules/news/announcements';
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
} from '#modules/news/blogs';
import {
  createSystemMessage,
  deleteSystemMessage,
  getSystemMessage,
  listSystemMessages,
  updateSystemMessage,
} from '#modules/news/system-messages';

export const newsRouter = {
  announcements: {
    create: createAnnouncement,
    delete: deleteAnnouncement,
    deleteImage: deleteAnnouncementImage,
    get: getAnnouncement,
    list: listAnnouncements,
    update: updateAnnouncement,
    uploadImage: uploadAnnouncementImage,
  },
  blogs: {
    create: createBlog,
    delete: deleteBlog,
    drafts: listDrafts,
    get: getBlogBySlug,
    getById: getBlogById,
    list: listPublishedBlogs,
    publish: publishBlog,
    unpublish: unpublishBlog,
    update: updateBlog,
  },
  systemMessages: {
    create: createSystemMessage,
    delete: deleteSystemMessage,
    get: getSystemMessage,
    list: listSystemMessages,
    update: updateSystemMessage,
  },
};
