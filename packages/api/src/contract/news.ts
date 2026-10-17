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

/** A delete answers with the id it removed — `noContent` is gone. Every news
 * entity's id is a uuid, like its `id` input, so the response says so too. */
const deleteResponseSchema = z.object({ id: z.uuid() });

export const newsContract = {
  announcements: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Create a new announcement',
          method: 'POST',
          operationId: 'postNewsAnnouncements',
          path: '/news/announcements',
          successStatus: 201,
          tags: ANNOUNCEMENT_TAGS,
        })
      )
      .input(announcementCreateSchema)
      .output(announcementTargetedRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete an announcement',
          method: 'DELETE',
          operationId: 'deleteNewsAnnouncementsById',
          path: '/news/announcements/{id}',
          tags: ANNOUNCEMENT_TAGS,
        })
      )
      .input(idInputSchema)
      .output(deleteResponseSchema),
    deleteImage: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete the image attached to an announcement',
          method: 'DELETE',
          operationId: 'deleteNewsAnnouncementsByIdImage',
          path: '/news/announcements/{id}/image',
          tags: ANNOUNCEMENT_TAGS,
        })
      )
      .input(idInputSchema)
      .output(announcementTargetedRowSchema),
    get: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Get a single announcement by ID',
          method: 'GET',
          operationId: 'getNewsAnnouncementsById',
          path: '/news/announcements/{id}',
          tags: ANNOUNCEMENT_TAGS,
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
          method: 'GET',
          operationId: 'getNewsAnnouncements',
          path: '/news/announcements',
          tags: ANNOUNCEMENT_TAGS,
        })
      )
      .input(announcementQuerySchema)
      .output(announcementListResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an existing announcement',
          method: 'PATCH',
          operationId: 'patchNewsAnnouncementsById',
          path: '/news/announcements/{id}',
          tags: ANNOUNCEMENT_TAGS,
        })
      )
      .input(announcementUpdateSchema.extend({ id: z.uuid() }))
      .output(announcementTargetedRowSchema),
    uploadImage: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Upload the image this announcement shows on the kiosk',
          method: 'POST',
          operationId: 'postNewsAnnouncementsByIdImage',
          path: '/news/announcements/{id}/image',
          tags: ANNOUNCEMENT_TAGS,
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
          method: 'POST',
          operationId: 'postNewsBlogs',
          path: '/news/blogs',
          successStatus: 201,
          tags: BLOG_TAGS,
        })
      )
      .input(blogCreateSchema)
      .output(blogPostRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a blog post',
          method: 'DELETE',
          operationId: 'deleteNewsBlogsById',
          path: '/news/blogs/{id}',
          tags: BLOG_TAGS,
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
          method: 'GET',
          operationId: 'getNewsBlogsDrafts',
          path: '/news/blogs/drafts',
          tags: BLOG_TAGS,
        })
      )
      .input(paginationSchema)
      .output(blogListResponseSchema),
    get: oc
      .route(
        filcRoute({
          description:
            'Get a published blog post by slug (public, no auth required)',
          method: 'GET',
          operationId: 'getNewsBlogsBySlug',
          path: '/news/blogs/{slug}',
          tags: BLOG_TAGS,
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
          method: 'GET',
          operationId: 'getNewsBlogsIdById',
          path: '/news/blogs/id/{id}',
          tags: BLOG_TAGS,
        })
      )
      .input(idInputSchema)
      .output(blogPostItemSchema),
    list: oc
      .route(
        filcRoute({
          description: 'List published blog posts (public, no auth required)',
          method: 'GET',
          operationId: 'getNewsBlogs',
          path: '/news/blogs',
          tags: BLOG_TAGS,
        })
      )
      .input(paginationSchema)
      .output(blogListResponseSchema),
    publish: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Publish a blog post (draft → published)',
          method: 'POST',
          operationId: 'postNewsBlogsByIdPublish',
          path: '/news/blogs/{id}/publish',
          tags: BLOG_TAGS,
        })
      )
      .input(idInputSchema)
      .output(blogPostRowSchema),
    unpublish: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Unpublish a blog post (published → draft)',
          method: 'POST',
          operationId: 'postNewsBlogsByIdUnpublish',
          path: '/news/blogs/{id}/unpublish',
          tags: BLOG_TAGS,
        })
      )
      .input(idInputSchema)
      .output(blogPostRowSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update a blog post',
          method: 'PATCH',
          operationId: 'patchNewsBlogsById',
          path: '/news/blogs/{id}',
          tags: BLOG_TAGS,
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
          method: 'POST',
          operationId: 'postNewsSystemMessages',
          path: '/news/system-messages',
          successStatus: 201,
          tags: SYSTEM_MESSAGE_TAGS,
        })
      )
      .input(dateRangeBodySchema)
      .output(systemMessageTargetedRowSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Delete a system message',
          method: 'DELETE',
          operationId: 'deleteNewsSystemMessagesById',
          path: '/news/system-messages/{id}',
          tags: SYSTEM_MESSAGE_TAGS,
        })
      )
      .input(idInputSchema)
      .output(deleteResponseSchema),
    get: oc
      .route(
        filcRoute({
          description: 'Get a single system message by ID',
          method: 'GET',
          operationId: 'getNewsSystemMessagesById',
          path: '/news/system-messages/{id}',
          tags: SYSTEM_MESSAGE_TAGS,
        })
      )
      .input(idInputSchema)
      .output(systemMessageItemSchema),
    list: oc
      .route(
        filcRoute({
          description:
            'List active system messages within date range, filtered by user cohort',
          method: 'GET',
          operationId: 'getNewsSystemMessages',
          path: '/news/system-messages',
          tags: SYSTEM_MESSAGE_TAGS,
        })
      )
      .input(announcementQuerySchema)
      .output(systemMessageListResponseSchema),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Update an existing system message',
          method: 'PATCH',
          operationId: 'patchNewsSystemMessagesById',
          path: '/news/system-messages/{id}',
          tags: SYSTEM_MESSAGE_TAGS,
        })
      )
      .input(dateRangeUpdateBodySchema.extend({ id: z.uuid() }))
      .output(systemMessageTargetedRowSchema),
  },
};
