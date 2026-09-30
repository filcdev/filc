import type { BlogUpdateInput } from '@filcdev/api/domains/news/blogs';
import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { blogPost } from '#database/schema/news';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';
import { ensureUniqueSlug, generateSlug } from '#utils/news/schemas';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';

const authorSelect = {
  id: user.id,
  image: user.image,
  name: user.name,
};

const checkSlugExists = async (slug: string, excludeId?: string) => {
  const conditions = [eq(blogPost.slug, slug)];
  if (excludeId) {
    conditions.push(sql`${blogPost.id} != ${excludeId}`);
  }
  const [existing] = await db
    .select({ id: blogPost.id })
    .from(blogPost)
    .where(and(...conditions));
  return !!existing;
};

export const listPublishedBlogs = base.news.blogs.list.handler(
  async ({ input }) => {
    const { limit, offset } = input;

    const where = eq(blogPost.status, 'published');

    const [items, totalResult] = await Promise.all([
      db
        .select({
          author: authorSelect,
          authorId: blogPost.authorId,
          content: blogPost.content,
          createdAt: blogPost.createdAt,
          id: blogPost.id,
          publishedAt: blogPost.publishedAt,
          slug: blogPost.slug,
          status: blogPost.status,
          title: blogPost.title,
          updatedAt: blogPost.updatedAt,
        })
        .from(blogPost)
        .leftJoin(user, eq(blogPost.authorId, user.id))
        .where(where)
        .orderBy(sql`${blogPost.publishedAt} DESC NULLS LAST`)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(blogPost).where(where),
    ]);

    return { data: items, total: totalResult[0]?.count ?? 0 };
  }
);

export const getBlogBySlug = base.news.blogs.get.handler(async ({ input }) => {
  const { slug } = input;

  const [item] = await db
    .select({
      author: authorSelect,
      authorId: blogPost.authorId,
      content: blogPost.content,
      createdAt: blogPost.createdAt,
      id: blogPost.id,
      publishedAt: blogPost.publishedAt,
      slug: blogPost.slug,
      status: blogPost.status,
      title: blogPost.title,
      updatedAt: blogPost.updatedAt,
    })
    .from(blogPost)
    .leftJoin(user, eq(blogPost.authorId, user.id))
    .where(and(eq(blogPost.slug, slug), eq(blogPost.status, 'published')));

  if (!item) {
    throw notFound('Blog post not found');
  }

  return item;
});

export const listDrafts = base.news.blogs.drafts
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ input }) => {
    const { limit, offset } = input;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          author: authorSelect,
          authorId: blogPost.authorId,
          content: blogPost.content,
          createdAt: blogPost.createdAt,
          id: blogPost.id,
          publishedAt: blogPost.publishedAt,
          slug: blogPost.slug,
          status: blogPost.status,
          title: blogPost.title,
          updatedAt: blogPost.updatedAt,
        })
        .from(blogPost)
        .leftJoin(user, eq(blogPost.authorId, user.id))
        .orderBy(sql`${blogPost.publishedAt} DESC NULLS LAST`)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(blogPost),
    ]);

    return { data: items, total: totalResult[0]?.count ?? 0 };
  });

export const getBlogById = base.news.blogs.getById
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [item] = await db
      .select({
        author: authorSelect,
        authorId: blogPost.authorId,
        content: blogPost.content,
        createdAt: blogPost.createdAt,
        id: blogPost.id,
        publishedAt: blogPost.publishedAt,
        slug: blogPost.slug,
        status: blogPost.status,
        title: blogPost.title,
        updatedAt: blogPost.updatedAt,
      })
      .from(blogPost)
      .leftJoin(user, eq(blogPost.authorId, user.id))
      .where(eq(blogPost.id, id));

    if (!item) {
      throw notFound('Blog post not found');
    }

    return item;
  });

export const createBlog = base.news.blogs.create
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ context, input }) => {
    const body = input;
    const authorId = context.session.userId;

    const baseSlug = body.slug ?? generateSlug(body.title);
    const slug = await ensureUniqueSlug(baseSlug, (s) => checkSlugExists(s));

    const publishedAt = body.status === 'published' ? new Date() : null;

    const [row] = await db
      .insert(blogPost)
      .values({
        authorId,
        content: body.content,
        publishedAt,
        slug,
        status: body.status,
        title: body.title,
      })
      .returning();

    if (!row) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create blog post',
      });
    }

    return row;
  });

export const updateBlog = base.news.blogs.update
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ input }) => {
    const { id } = input;
    const body: BlogUpdateInput = input;

    const [existing] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.id, id));

    if (!existing) {
      throw notFound('Blog post not found');
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.content !== undefined) {
      updateData.content = body.content;
    }

    if (body.slug !== undefined) {
      const slug = await ensureUniqueSlug(body.slug, (s) =>
        checkSlugExists(s, id)
      );
      updateData.slug = slug;
    }

    const [updated] = await db
      .update(blogPost)
      .set(updateData)
      .where(eq(blogPost.id, id))
      .returning();

    if (!updated) {
      throw notFound('Blog post not found');
    }

    return updated;
  });

export const publishBlog = base.news.blogs.publish
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [existing] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.id, id));

    if (!existing) {
      throw notFound('Blog post not found');
    }

    if (existing.status === 'published') {
      throw badRequest('Blog post is already published');
    }

    const [updated] = await db
      .update(blogPost)
      .set({ publishedAt: new Date(), status: 'published' })
      .where(eq(blogPost.id, id))
      .returning();

    if (!updated) {
      throw notFound('Blog post not found');
    }

    dispatchPendingNotification(id, 'blog_post', {
      slug: existing.slug,
      title: existing.title,
    });

    return updated;
  });

export const unpublishBlog = base.news.blogs.unpublish
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [existing] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.id, id));

    if (!existing) {
      throw notFound('Blog post not found');
    }

    if (existing.status === 'draft') {
      throw badRequest('Blog post is already a draft');
    }

    const [updated] = await db
      .update(blogPost)
      .set({ publishedAt: null, status: 'draft' })
      .where(eq(blogPost.id, id))
      .returning();

    if (!updated) {
      throw notFound('Blog post not found');
    }

    cancelPendingNotification(id, 'blog_post');

    return updated;
  });

export const deleteBlog = base.news.blogs.delete
  .use(requireAuthorization(permissions.newsBlogsManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [deleted] = await db
      .delete(blogPost)
      .where(eq(blogPost.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Blog post not found');
    }

    return { id };
  });
