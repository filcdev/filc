import { zValidator } from '@hono/zod-validator';
import { desc } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { bugReport } from '#database/schema/bug-report';
import { requireAuthentication } from '#middleware/auth';
import { bugReportFactory } from '#routes/bug-report/_factory';

const createBugReportSchema = z.object({
  description: z.string().min(10).max(5000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  page: z.string().max(255).optional(),
  subject: z.string().min(3).max(200),
});

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
