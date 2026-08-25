import { createBugReportSchema } from '@filcdev/api/domains/bug-report';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { desc } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { bugReport } from '#database/schema/bug-report';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { bugReportFactory } from '#routes/bug-report/_factory';

export const createBugReport = bugReportFactory.createHandlers(
  requireAuthentication,
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

    return c.json<SuccessResponse<{ id: string }>>({
      data: { id: inserted.id },
      success: true,
    });
  }
);

export const listBugReports = bugReportFactory.createHandlers(
  requireAuthentication,
  requireAuthorization(permissions.bugReportsRead),
  async (c) => {
    const reports = await db
      .select()
      .from(bugReport)
      .orderBy(desc(bugReport.createdAt))
      .limit(100);

    return c.json<SuccessResponse<typeof reports>>({
      data: reports,
      success: true,
    });
  }
);
