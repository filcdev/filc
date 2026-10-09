import { oc } from '@orpc/contract';
import z from 'zod';
import {
  announcementCreateSchema,
  announcementImageUploadSchema,
  announcementItemSchema,
  announcementListResponseSchema,
  announcementQuerySchema,
  announcementTargetedRowSchema,
  announcementUpdateSchema,
  paginationSchema,
} from '../domains/news/announcements';
import {
  blogCreateSchema,
  blogListResponseSchema,
  blogPostItemSchema,
  blogPostRowSchema,
  blogUpdateSchema,
} from '../domains/news/blogs';
import {
  dateRangeBodySchema,
  dateRangeUpdateBodySchema,
  systemMessageItemSchema,
  systemMessageListResponseSchema,
  systemMessageTargetedRowSchema,
} from '../domains/news/system-messages';
import { filcRoute } from './route';

const ANNOUNCEMENT_TAGS = ['News / Announcements'];
const BLOG_TAGS = ['News / Blogs'];
const SYSTEM_MESSAGE_TAGS = ['News / System Messages'];

/** Every `{id}` action takes the id alone as its input. */
const idInputSchema = z.object({ id: z.uuid() });

/** A delete answers with the id it removed — `noContent` is gone. */
const deleteResponseSchema = z.object({ id: z.string() });

export const newsContract = {
  announcements: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new announcement',
          group: 'Announcement',
          method: 'POST',
          operationId: 'postNewsAnnouncements',
          path: '/news/announcements',
          successStatus: 201,
          tags: ANNOUNCEMENT_TAGS,
          type: '@unit Announcement',
        })
      )
      .input(announcementCreateSchema)
      .output(announcementTargetedRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete an announcement',
          group: 'Announcement',
          method: 'DELETE',
          operationId: 'deleteNewsAnnouncementsById',
          path: '/news/announcements/{id}',
          successStatus: 200,
          tags: ANNOUNCEMENT_TAGS,
          type: '@nodata',
        })
      )
      .input(idInputSchema)
      .output(deleteResponseSchema),
    deleteImage: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete the image attached to an announcement',
          group: 'Announcement',
          method: 'DELETE',
          operationId: 'deleteNewsAnnouncementsByIdImage',
          path: '/news/announcements/{id}/image',
          successStatus: 200,
          tags: ANNOUNCEMENT_TAGS,
          type: '@unit Announcement',
        })
      )
      .input(idInputSchema)
      .output(announcementTargetedRowSchema),
    get: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get a single announcement by ID',
          group: 'Announcement',
          method: 'GET',
          operationId: 'getNewsAnnouncementsById',
          path: '/news/announcements/{id}',
          successStatus: 200,
          tags: ANNOUNCEMENT_TAGS,
          type: '@unit Announcement @field(.author, Author)',
        })
      )
      .input(idInputSchema)
      .output(announcementItemSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'List active announcements within date range, cohort-filtered by default; includeAll=true returns everything',
          group: 'Announcement',
          method: 'GET',
          operationId: 'getNewsAnnouncements',
          path: '/news/announcements',
          successStatus: 200,
          tags: ANNOUNCEMENT_TAGS,
          type: '@listof Announcement @field(.author, Author)',
        })
      )
      .input(announcementQuerySchema)
      .output(announcementListResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an existing announcement',
          group: 'Announcement',
          method: 'PATCH',
          operationId: 'patchNewsAnnouncementsById',
          path: '/news/announcements/{id}',
          successStatus: 200,
          tags: ANNOUNCEMENT_TAGS,
          type: '@unit Announcement',
        })
      )
      .input(announcementUpdateSchema.extend({ id: z.uuid() }))
      .output(announcementTargetedRowSchema),
    uploadImage: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Upload the image this announcement shows on the kiosk',
          group: 'Announcement',
          method: 'POST',
          operationId: 'postNewsAnnouncementsByIdImage',
          path: '/news/announcements/{id}/image',
          successStatus: 200,
          tags: ANNOUNCEMENT_TAGS,
          type: '@unit Announcement',
        })
      )
      .input(announcementImageUploadSchema.extend({ id: z.uuid() }))
      .output(announcementTargetedRowSchema),
  },
  blogs: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new blog post (defaults to draft)',
          group: 'BlogPost',
          method: 'POST',
          operationId: 'postNewsBlogs',
          path: '/news/blogs',
          successStatus: 201,
          tags: BLOG_TAGS,
          type: '@unit BlogPost',
        })
      )
      .input(blogCreateSchema)
      .output(blogPostRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a blog post',
          group: 'BlogPost',
          method: 'DELETE',
          operationId: 'deleteNewsBlogsById',
          path: '/news/blogs/{id}',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@nodata',
        })
      )
      .input(idInputSchema)
      .output(deleteResponseSchema),
    drafts: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'List all blog posts including drafts (requires permission)',
          group: 'BlogPost',
          method: 'GET',
          operationId: 'getNewsBlogsDrafts',
          path: '/news/blogs/drafts',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@listof BlogPost @field(.author, Author)',
        })
      )
      .input(paginationSchema)
      .output(blogListResponseSchema),
    get: oc
      .route(
        filcRoute({
          description:
            'Get a published blog post by slug (public, no auth required)',
          group: 'BlogPost',
          method: 'GET',
          operationId: 'getNewsBlogsBySlug',
          path: '/news/blogs/{slug}',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@unit BlogPost @field(.author, Author)',
        })
      )
      .input(z.object({ slug: z.string() }))
      .output(blogPostItemSchema),
    getById: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Get any blog post by ID including drafts (requires permission)',
          group: 'BlogPost',
          method: 'GET',
          operationId: 'getNewsBlogsIdById',
          path: '/news/blogs/id/{id}',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@unit BlogPost @field(.author, Author)',
        })
      )
      .input(idInputSchema)
      .output(blogPostItemSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List published blog posts (public, no auth required)',
          group: 'BlogPost',
          method: 'GET',
          operationId: 'getNewsBlogs',
          path: '/news/blogs',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@listof BlogPost @field(.author, Author)',
        })
      )
      .input(paginationSchema)
      .output(blogListResponseSchema),
    publish: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Publish a blog post (draft → published)',
          group: 'BlogPost',
          method: 'POST',
          operationId: 'postNewsBlogsByIdPublish',
          path: '/news/blogs/{id}/publish',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@unit BlogPost',
        })
      )
      .input(idInputSchema)
      .output(blogPostRowSchema),
    unpublish: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Unpublish a blog post (published → draft)',
          group: 'BlogPost',
          method: 'POST',
          operationId: 'postNewsBlogsByIdUnpublish',
          path: '/news/blogs/{id}/unpublish',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@unit BlogPost',
        })
      )
      .input(idInputSchema)
      .output(blogPostRowSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a blog post',
          group: 'BlogPost',
          method: 'PATCH',
          operationId: 'patchNewsBlogsById',
          path: '/news/blogs/{id}',
          successStatus: 200,
          tags: BLOG_TAGS,
          type: '@unit BlogPost',
        })
      )
      .input(blogUpdateSchema.extend({ id: z.uuid() }))
      .output(blogPostRowSchema),
  },
  systemMessages: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new system message',
          group: 'SystemMessage',
          method: 'POST',
          operationId: 'postNewsSystemMessages',
          path: '/news/system-messages',
          successStatus: 201,
          tags: SYSTEM_MESSAGE_TAGS,
          type: '@unit SystemMessage',
        })
      )
      .input(dateRangeBodySchema)
      .output(systemMessageTargetedRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a system message',
          group: 'SystemMessage',
          method: 'DELETE',
          operationId: 'deleteNewsSystemMessagesById',
          path: '/news/system-messages/{id}',
          successStatus: 200,
          tags: SYSTEM_MESSAGE_TAGS,
          type: '@nodata',
        })
      )
      .input(idInputSchema)
      .output(deleteResponseSchema),
    get: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get a single system message by ID',
          group: 'SystemMessage',
          method: 'GET',
          operationId: 'getNewsSystemMessagesById',
          path: '/news/system-messages/{id}',
          successStatus: 200,
          tags: SYSTEM_MESSAGE_TAGS,
          type: '@unit SystemMessage @field(.author, Author)',
        })
      )
      .input(idInputSchema)
      .output(systemMessageItemSchema),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'List active system messages within date range, filtered by user cohort',
          group: 'SystemMessage',
          method: 'GET',
          operationId: 'getNewsSystemMessages',
          path: '/news/system-messages',
          successStatus: 200,
          tags: SYSTEM_MESSAGE_TAGS,
          type: '@listof SystemMessage @field(.author, Author)',
        })
      )
      .input(announcementQuerySchema)
      .output(systemMessageListResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an existing system message',
          group: 'SystemMessage',
          method: 'PATCH',
          operationId: 'patchNewsSystemMessagesById',
          path: '/news/system-messages/{id}',
          successStatus: 200,
          tags: SYSTEM_MESSAGE_TAGS,
          type: '@unit SystemMessage',
        })
      )
      .input(dateRangeUpdateBodySchema.extend({ id: z.uuid() }))
      .output(systemMessageTargetedRowSchema),
  },
};
