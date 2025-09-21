import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { db } from '~/database';
import { card } from '~/database/schema/doorlock';
import { userHasPermission } from '~/utils/authorization';
import { env } from '~/utils/environment';
import type { SuccessResponse } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { doorlockFactory } from './_factory';

const createCardSchema = z.object({
  tag: z.string().min(1),
  userId: z.string().uuid(),
  label: z.string().optional(),
  frozen: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

const updateCardSchema = z.object({
  label: z.string().optional(),
  frozen: z.boolean().optional(),
  disabled: z.boolean().optional(),
  userId: z.string().uuid().optional(),
});

export const listCards = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const currentUserId = c.var.session.userId;
    const canReadAll = await userHasPermission(currentUserId, 'card:read');
    const rows = canReadAll
      ? await db.select().from(card)
      : await db.select().from(card).where(eq(card.userId, currentUserId));
    return c.json<SuccessResponse>({
      success: true,
      data: rows,
    });
  }
);

export const getCard = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const currentUserId = c.var.session.userId;
    const [row] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!row) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: 'Not found' });
    }
    const canReadAll = await userHasPermission(currentUserId, 'card:read');
    if (!canReadAll && row.userId !== currentUserId) {
      throw new HTTPException(StatusCodes.FORBIDDEN, { message: 'Forbidden' });
    }
    return c.json<SuccessResponse>({
      success: true,
      data: row,
    });
  }
);

export const createCard = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('card:create'),
  zValidator('json', createCardSchema),
  async (c) => {
    const data = c.req.valid('json');
    try {
      const [inserted] = await db
        .insert(card)
        .values({
          tag: data.tag,
          userId: data.userId,
          label: data.label,
          frozen: data.frozen ?? false,
          disabled: data.disabled ?? false,
        })
        .returning();
      return c.json<SuccessResponse>({
        success: true,
        data: inserted,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create card',
        cause: env.mode === 'development' ? String(err) : undefined,
      });
    }
  }
);

export const updateCard = doorlockFactory.createHandlers(
  requireAuthentication,
  zValidator('json', updateCardSchema),
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const data = c.req.valid('json');
    const [existing] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: 'Not found' });
    }

    const currentUserId = c.var.session.userId;
    const canUpdate = await userHasPermission(currentUserId, 'card:update');
    if (!canUpdate) {
      if (existing.userId !== currentUserId) {
        throw new HTTPException(StatusCodes.FORBIDDEN, {
          message: 'Forbidden',
        });
      }

      const { label } = data;
      try {
        const [updated] = await db
          .update(card)
          .set({ label })
          .where(eq(card.id, id as string))
          .returning();
        return c.json<SuccessResponse>({
          success: true,
          data: updated,
        });
      } catch (err) {
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          message: 'Failed to update card',
          cause: env.mode === 'development' ? String(err) : undefined,
        });
      }
    }
    try {
      const [updated] = await db
        .update(card)
        .set(data)
        .where(eq(card.id, id as string))
        .returning();
      return c.json<SuccessResponse>({
        success: true,
        data: updated,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update card',
        cause: env.mode === 'development' ? String(err) : undefined,
      });
    }
  }
);

export const deleteCard = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Missing id',
      });
    }
    const [existing] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, { message: 'Not found' });
    }
    const currentUserId = c.var.session.userId;
    const canDelete = await userHasPermission(currentUserId, 'card:delete');
    if (!canDelete && existing.userId !== currentUserId) {
      throw new HTTPException(StatusCodes.FORBIDDEN, { message: 'Forbidden' });
    }
    try {
      const [deleted] = await db
        .delete(card)
        .where(eq(card.id, id as string))
        .returning();
      return c.json<SuccessResponse>({
        success: true,
        data: deleted,
      });
    } catch (err) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to delete card',
        cause: env.mode === 'development' ? String(err) : undefined,
      });
    }
  }
);
