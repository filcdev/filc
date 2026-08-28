import { createBugReportSchema } from '@filcdev/api/domains/bug-report';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { bugReport, bugReportStatuses } from '#database/schema/bug-report';
import { authRouter } from '#middleware/auth';
import { bugReportFactory } from '#routes/bug-report/_factory';
import { created, ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';

const bugReportSelectSchema = createSelectSchema(bugReport);

const bugReportQuerySchema = z.object({
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
  status: z.enum(bugReportStatuses).optional(),
});

const bugReportStatusUpdateSchema = z.object({
  status: z.enum(bugReportStatuses),
});

const bugReportListResponseSchema = z.object({
  reports: z.array(bugReportSelectSchema),
  total: z.number(),
});

const { schema: createRequestSchema } = await resolver(
  createBugReportSchema
).toOpenAPISchema();
const { schema: statusUpdateRequestSchema } = await resolver(
  bugReportStatusUpdateSchema
).toOpenAPISchema();

export const createBugReport = bugReportFactory.createHandlers(
  describeRoute({
    ...filcExt('BugReport', '@unit BugReport', true),
    description: 'Create a new bug report',
    requestBody: {
      content: {
        'application/json': {
          schema: createRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(z.object({ id: z.string().uuid() })),
          },
        },
        description: 'Bug report created',
      },
      400: { description: 'Invalid input' },
    },
    tags: ['Bug Reports'],
  }),
  ...authRouter(),
  zValidator('json', createBugReportSchema),
  async (c) => {
    const { description, metadata, page, subject } = c.req.valid('json');
    const user = c.var.user;

    const [inserted] = await db
      .insert(bugReport)
      .values({
        description,
        metadata,
        page,
        reporterEmail: user?.email ?? null,
        reporterId: user?.id ?? null,
        subject,
      })
      .returning({ id: bugReport.id });

    if (!inserted) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to store bug report',
      });
    }

    return created(c, { id: inserted.id });
  }
);

export const listBugReports = bugReportFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'BugReport',
      '@unit BugReportListResponse @field(.reports, List<BugReport>)',
      true
    ),
    description: 'List bug reports with optional filters and paging',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(bugReportListResponseSchema),
          },
        },
        description: 'Paginated list of bug reports',
      },
    },
    tags: ['Bug Reports'],
  }),
  ...authRouter(permissions.bugReportsRead),
  zValidator('query', bugReportQuerySchema),
  async (c) => {
    const { dateFrom, dateTo, limit, page, search, status } =
      c.req.valid('query');

    const conditions: (SQL | undefined)[] = [];

    if (status) {
      conditions.push(eq(bugReport.status, status));
    }
    if (dateFrom) {
      conditions.push(gte(bugReport.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(bugReport.createdAt, new Date(dateTo)));
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(bugReport.subject, pattern),
          ilike(bugReport.description, pattern),
          ilike(bugReport.reporterEmail, pattern)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * limit;

    const [reports, totalResult] = await Promise.all([
      db
        .select()
        .from(bugReport)
        .where(where)
        .orderBy(desc(bugReport.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(bugReport).where(where),
    ]);

    return ok(c, { reports, total: totalResult[0]?.count ?? 0 });
  }
);

export const updateBugReportStatus = bugReportFactory.createHandlers(
  describeRoute({
    ...filcExt('BugReport', '@unit BugReport', true),
    description: 'Update a bug report status',
    requestBody: {
      content: {
        'application/json': {
          schema: statusUpdateRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(bugReportSelectSchema),
          },
        },
        description: 'Bug report status updated',
      },
      404: { description: 'Bug report not found' },
    },
    tags: ['Bug Reports'],
  }),
  ...authRouter(permissions.bugReportsWrite),
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', bugReportStatusUpdateSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { status } = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(bugReport)
      .where(eq(bugReport.id, id));

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Bug report not found',
      });
    }

    const [updated] = await db
      .update(bugReport)
      .set({ status })
      .where(eq(bugReport.id, id))
      .returning();

    if (!updated) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Bug report not found',
      });
    }

    return ok(c, updated);
  }
);
