import { zValidator } from '@hono/zod-validator';
import { eq, like, or, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';

import z from 'zod';
import { db } from '#database';
import { authRouter } from '#middleware/auth';
import { timetableFactory } from '#routes/timetable/_factory';
import { notFound, ok } from '#utils/http';
import { filcExt } from '#utils/openapi';

/**
 * Config for a flat (reference-data) CRUD resource. `insert/update/select`
 * schemas are derived by the caller (e.g. `createInsertSchema(table).omit(...)`)
 * so the concrete column types are known; the generator only wires the handlers.
 */
export type CrudConfig<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** Route path segment and OpenAPI tag, e.g. `subjects`. */
  resource: string;
  /** Permission required for the write routes. */
  permission: string;
  /** The primary-key column of the table. */
  idColumn: PgColumn;
  /** The insert request schema (already omitting id/server-managed columns). */
  insertSchema: z.ZodTypeAny;
  /** The select/row schema. */
  selectSchema: TSchema;
  /** The update request schema (partial, omitting id/server-managed columns). */
  updateSchema: z.ZodTypeAny;
  /** Columns used to sort the list (pass `.asc()` columns / SQL). */
  orderBy?: SQL[];
  /** Columns to match against the `search` query param. */
  searchable?: PgColumn[];
  table: PgTable;
};

const idParamsSchema = z.object({ id: z.string() });

const pagingSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Build list / getById / create / update / delete handlers for a single flat
 * table, wired for OpenAPI, auth/permission gating, `zValidator` runtime
 * validation and the `{ data, success }` envelope.
 */
export async function createCrudHandlers<TSchema extends z.ZodTypeAny>(
  config: CrudConfig<TSchema>
) {
  const {
    idColumn,
    insertSchema,
    orderBy = [],
    permission,
    resource,
    searchable = [],
    selectSchema,
    table,
    updateSchema,
  } = config;

  const dbTable = table as never;
  const { schema: insertOpenapi } =
    await resolver(insertSchema).toOpenAPISchema();
  const { schema: updateOpenapi } =
    await resolver(updateSchema).toOpenAPISchema();
  const typeName = titleCase(resource);
  const tags = ['Timetable'];
  const recordResponse = z.object({ data: selectSchema, success: z.boolean() });
  const recordsResponse = z.object({
    data: selectSchema.array(),
    success: z.boolean(),
    total: z.number(),
  });

  const list = timetableFactory.createHandlers(
    describeRoute({
      ...filcExt(resource, `@listof ${typeName}`, true),
      description: `List ${resource}.`,
      responses: {
        200: {
          content: {
            'application/json': { schema: resolver(recordsResponse) },
          },
          description: 'List of records',
        },
      },
      tags,
    }),
    ...authRouter(),
    zValidator('query', pagingSchema),
    async (c) => {
      const { limit, offset, search } = c.req.valid('query');
      const where =
        search && searchable.length
          ? or(...searchable.map((col) => like(col, `%${search}%`)))
          : undefined;

      const [rows, total] = await Promise.all([
        db
          .select()
          .from(dbTable)
          .where(where)
          .orderBy(...orderBy)
          .limit(limit)
          .offset(offset),
        db.$count(dbTable, where),
      ]);

      return ok(c, rows as z.infer<TSchema>[], StatusCodes.OK, { total });
    }
  );

  const getById = timetableFactory.createHandlers(
    describeRoute({
      ...filcExt(resource, `@unit ${typeName}`, true),
      description: `Get a single ${resource} by id.`,
      parameters: [
        { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          content: { 'application/json': { schema: resolver(recordResponse) } },
          description: 'The record',
        },
      },
      tags,
    }),
    ...authRouter(),
    zValidator('param', idParamsSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const [row] = await db
        .select()
        .from(dbTable)
        .where(eq(idColumn, id))
        .limit(1);
      if (!row) {
        throw notFound(`${resource} not found`);
      }
      return ok(c, row as z.infer<TSchema>);
    }
  );

  const create = timetableFactory.createHandlers(
    describeRoute({
      ...filcExt(resource, `@unit ${typeName}`, true),
      description: `Create a ${resource}.`,
      requestBody: {
        content: { 'application/json': { schema: insertOpenapi as never } },
        required: true,
      },
      responses: {
        200: {
          content: { 'application/json': { schema: resolver(recordResponse) } },
          description: 'The created record',
        },
      },
      tags,
    }),
    ...authRouter(permission),
    zValidator('json', insertSchema),
    async (c) => {
      const input = c.req.valid('json') as Record<string, unknown>;
      const [row] = (await db
        .insert(dbTable)
        .values({ ...input, id: crypto.randomUUID() } as never)
        .returning()) as z.infer<TSchema>[];
      if (!row) {
        throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
          message: `Failed to create ${resource}`,
        });
      }
      return ok(c, row as z.infer<TSchema>, StatusCodes.CREATED);
    }
  );

  const update = timetableFactory.createHandlers(
    describeRoute({
      ...filcExt(resource, `@unit ${typeName}`, true),
      description: `Update a ${resource}.`,
      parameters: [
        { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        content: { 'application/json': { schema: updateOpenapi as never } },
        required: true,
      },
      responses: {
        200: {
          content: { 'application/json': { schema: resolver(recordResponse) } },
          description: 'The updated record',
        },
      },
      tags,
    }),
    ...authRouter(permission),
    zValidator('param', idParamsSchema),
    zValidator('json', updateSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');
      const [row] = (await db
        .update(dbTable)
        .set(input as never)
        .where(eq(idColumn, id))
        .returning()) as z.infer<TSchema>[];
      if (!row) {
        throw notFound(`${resource} not found`);
      }
      return ok(c, row as z.infer<TSchema>);
    }
  );

  const remove = timetableFactory.createHandlers(
    describeRoute({
      ...filcExt(resource, `@nodata ${typeName}`, true),
      description: `Delete a ${resource}.`,
      parameters: [
        { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
      ],
      responses: {
        200: {
          content: {
            'application/json': {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
          description: 'Deleted',
        },
      },
      tags,
    }),
    ...authRouter(permission),
    zValidator('param', idParamsSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const [deleted] = (await db
        .delete(dbTable)
        .where(eq(idColumn, id))
        .returning()) as z.infer<TSchema>[];
      if (!deleted) {
        throw notFound(`${resource} not found`);
      }
      return ok(c, null, StatusCodes.OK);
    }
  );

  return { create, getById, list, remove, update };
}
