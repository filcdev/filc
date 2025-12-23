import { zValidator } from '@hono/zod-validator';
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { usersFactory } from '#routes/users/_factory';
import type { User } from '#utils/authentication';
import { getUserPermissions } from '#utils/authorization';
import type { SuccessResponse } from '#utils/globals';
import { requireAuthentication, requireAuthorization } from '#utils/middleware';

const listUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});

const userUpdatePayload = z.object({
  nickname: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

const updateUserBodySchema = (
  await resolver(userUpdatePayload).toOpenAPISchema()
).schema;

export const listUsers = usersFactory.createHandlers(
  describeRoute({
    description: 'List users',
    responses: {
      200: {
        description: 'List of users',
      },
    },
    tags: ['Users'],
  }),
  requireAuthentication,
  requireAuthorization('users:manage'),
  zValidator('query', listUsersQuerySchema),
  async (c) => {
    const { limit, offset, search } = c.req.valid('query');

    const whereClause = search
      ? or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(user.nickname, `%${search}%`)
        )
      : undefined;

    const usersQuery = await db
      .select()
      .from(user)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(user.createdAt));

    const users = await Promise.all(
      usersQuery.map(async (u) => ({
        ...u,
        displayName: u.nickname ? u.nickname : u.name || 'Unknown user',
        permissions: await getUserPermissions(u.id),
      }))
    );

    const userCount = await db
      .select({ count: count() })
      .from(user)
      .where(whereClause);

    return c.json<SuccessResponse<{ users: User[]; total: number }>>({
      data: { total: Number(userCount), users },
      success: true,
    });
  }
);

export const updateUser = usersFactory.createHandlers(
  describeRoute({
    description: 'Update user',
    requestBody: {
      content: {
        'application/json': { schema: updateUserBodySchema },
      },
    },
    responses: {
      200: {
        description: 'User updated',
      },
    },
    tags: ['Users'],
  }),
  requireAuthentication,
  requireAuthorization('users:manage'),
  zValidator('json', userUpdatePayload),
  async (c) => {
    const userId = c.req.param('id');
    if (!userId) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'User ID is required',
      });
    }
    const { nickname, roles } = c.req.valid('json');

    const [updatedUser] = await db
      .update(user)
      .set({
        ...(nickname !== undefined ? { nickname } : {}),
        ...(roles !== undefined ? { roles } : {}),
      })
      .where(eq(user.id, userId))
      .returning();

    if (!updatedUser) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'User not found',
      });
    }

    return c.json<SuccessResponse<typeof updatedUser>>({
      data: updatedUser,
      success: true,
    });
  }
);
