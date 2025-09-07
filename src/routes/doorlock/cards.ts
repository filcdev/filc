import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { db } from '~/database';
import { card } from '~/database/schema/doorlock';
import { userHasPermission } from '~/utils/authorization';
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
    return c.json(rows);
  }
);

export const getCard = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const currentUserId = c.var.session.userId;
    const [row] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!row) {
      return c.json({ error: 'Not found' }, StatusCodes.NOT_FOUND);
    }
    const canReadAll = await userHasPermission(currentUserId, 'card:read');
    if (!canReadAll && row.userId !== currentUserId) {
      return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
    }
    return c.json(row);
  }
);

export const createCard = doorlockFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('card:create'),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = createCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        StatusCodes.BAD_REQUEST
      );
    }
    try {
      const [inserted] = await db
        .insert(card)
        .values({
          tag: parsed.data.tag,
          userId: parsed.data.userId,
          label: parsed.data.label,
          frozen: parsed.data.frozen ?? false,
          disabled: parsed.data.disabled ?? false,
        })
        .returning();
      return c.json(inserted, StatusCodes.CREATED);
    } catch (err) {
      return c.json(
        { error: 'Failed to create card', details: String(err) },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export const updateCard = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = updateCardSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        StatusCodes.BAD_REQUEST
      );
    }
    const [existing] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!existing) {
      return c.json({ error: 'Not found' }, StatusCodes.NOT_FOUND);
    }

    const currentUserId = c.var.session.userId;
    const canUpdate = await userHasPermission(currentUserId, 'card:update');
    if (!canUpdate) {
      if (existing.userId !== currentUserId) {
        return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
      }
      // Without card.update permission only label can change
      const { label } = parsed.data;
      try {
        const [updated] = await db
          .update(card)
          .set({ label })
          .where(eq(card.id, id as string))
          .returning();
        return c.json(updated);
      } catch (err) {
        return c.json(
          { error: 'Failed to update card', details: String(err) },
          StatusCodes.INTERNAL_SERVER_ERROR
        );
      }
    }
    try {
      const [updated] = await db
        .update(card)
        .set(parsed.data)
        .where(eq(card.id, id as string))
        .returning();
      return c.json(updated);
    } catch (err) {
      return c.json(
        { error: 'Failed to update card', details: String(err) },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);

export const deleteCard = doorlockFactory.createHandlers(
  requireAuthentication,
  async (c) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'Missing id' }, StatusCodes.BAD_REQUEST);
    }
    const [existing] = await db
      .select()
      .from(card)
      .where(eq(card.id, id as string))
      .limit(1);
    if (!existing) {
      return c.json({ error: 'Not found' }, StatusCodes.NOT_FOUND);
    }
    const currentUserId = c.var.session.userId;
    const canDelete = await userHasPermission(currentUserId, 'card:delete');
    if (!canDelete && existing.userId !== currentUserId) {
      return c.json({ error: 'Forbidden' }, StatusCodes.FORBIDDEN);
    }
    try {
      const [deleted] = await db
        .delete(card)
        .where(eq(card.id, id as string))
        .returning();
      return c.json(deleted);
    } catch (err) {
      return c.json(
        { error: 'Failed to delete card', details: String(err) },
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
);
