import { zValidator } from '@hono/zod-validator';
import { and, count, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { blogPost } from '#database/schema/news';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { newsFactory } from '#routes/news/_factory';
import {
  blogCreateSchema,
  blogUpdateSchema,
  ensureUniqueSlug,
  generateSlug,
  paginationSchema,
} from '#utils/news/schemas';

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

export const listPublishedBlogs = newsFactory.createHandlers(
  describeRoute({
    description: 'List published blog posts (public, no auth required)',
    responses: {
      200: { description: 'Paginated list of published blog posts' },
    },
    tags: ['News / Blogs'],
  }),
  zValidator('query', paginationSchema),
  async (c) => {
    const { limit, offset } = c.req.valid('query');

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

    return c.json<SuccessResponse<typeof items> & { total: number }>({
      data: items,
      success: true,
      total: totalResult[0]?.count ?? 0,
    });
  }
);

export const getBlogBySlug = newsFactory.createHandlers(
  describeRoute({
    description: 'Get a published blog post by slug (public, no auth required)',
    responses: {
      200: { description: 'Blog post details' },
    },
    tags: ['News / Blogs'],
  }),
  zValidator('param', z.object({ slug: z.string() })),
  async (c) => {
    const { slug } = c.req.valid('param');

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
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Blog post not found',
      });
    }

    return c.json<SuccessResponse<typeof item>>({
      data: item,
      success: true,
    });
  }
);

export const listDrafts = newsFactory.createHandlers(
  describeRoute({
    description: 'List all blog posts including drafts (requires permission)',
    responses: {
      200: { description: 'Paginated list of all blog posts' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('query', paginationSchema),
  async (c) => {
    const { limit, offset } = c.req.valid('query');

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

    return c.json<SuccessResponse<typeof items> & { total: number }>({
      data: items,
      success: true,
      total: totalResult[0]?.count ?? 0,
    });
  }
);

export const getBlogById = newsFactory.createHandlers(
  describeRoute({
    description:
      'Get any blog post by ID including drafts (requires permission)',
    responses: {
      200: { description: 'Blog post details' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

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
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Blog post not found',
      });
    }

    return c.json<SuccessResponse<typeof item>>({
      data: item,
      success: true,
    });
  }
);

export const createBlog = newsFactory.createHandlers(
  describeRoute({
    description: 'Create a new blog post (defaults to draft)',
    responses: {
      201: { description: 'Blog post created' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('json', blogCreateSchema),
  async (c) => {
    const body = c.req.valid('json');
    const currentUser = c.var.user;

    const baseSlug = body.slug ?? generateSlug(body.title);
    const slug = await ensureUniqueSlug(baseSlug, (s) => checkSlugExists(s));

    const publishedAt = body.status === 'published' ? new Date() : null;

    const [created] = await db
      .insert(blogPost)
      .values({
        authorId: currentUser.id,
        content: body.content,
        publishedAt,
        slug,
        status: body.status,
        title: body.title,
      })
      .returning();

    return c.json<SuccessResponse<typeof created>>(
      {
        data: created,
        success: true,
      },
      StatusCodes.CREATED
    );
  }
);

export const updateBlog = newsFactory.createHandlers(
  describeRoute({
    description: 'Update a blog post',
    responses: {
      200: { description: 'Blog post updated' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', blogUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.id, id));

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Blog post not found',
      });
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

    return c.json<SuccessResponse<typeof updated>>({
      data: updated,
      success: true,
    });
  }
);

export const publishBlog = newsFactory.createHandlers(
  describeRoute({
    description: 'Publish a blog post (draft → published)',
    responses: {
      200: { description: 'Blog post published' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.id, id));

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Blog post not found',
      });
    }

    if (existing.status === 'published') {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Blog post is already published',
      });
    }

    const [updated] = await db
      .update(blogPost)
      .set({ publishedAt: new Date(), status: 'published' })
      .where(eq(blogPost.id, id))
      .returning();

    return c.json<SuccessResponse<typeof updated>>({
      data: updated,
      success: true,
    });
  }
);

export const unpublishBlog = newsFactory.createHandlers(
  describeRoute({
    description: 'Unpublish a blog post (published → draft)',
    responses: {
      200: { description: 'Blog post unpublished' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [existing] = await db
      .select()
      .from(blogPost)
      .where(eq(blogPost.id, id));

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Blog post not found',
      });
    }

    if (existing.status === 'draft') {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Blog post is already a draft',
      });
    }

    const [updated] = await db
      .update(blogPost)
      .set({ publishedAt: null, status: 'draft' })
      .where(eq(blogPost.id, id))
      .returning();

    return c.json<SuccessResponse<typeof updated>>({
      data: updated,
      success: true,
    });
  }
);

export const deleteBlog = newsFactory.createHandlers(
  describeRoute({
    description: 'Delete a blog post',
    responses: {
      200: { description: 'Blog post deleted' },
    },
    tags: ['News / Blogs'],
  }),
  requireAuthentication,
  requireAuthorization('news:blogs'),
  zValidator('param', z.object({ id: z.string().uuid() })),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(blogPost)
      .where(eq(blogPost.id, id))
      .returning();

    if (!deleted) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Blog post not found',
      });
    }

    return c.json<SuccessResponse>({
      success: true,
    });
  }
);
