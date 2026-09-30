import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
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
import { db } from '#database';
import { bugReport } from '#database/schema/bug-report';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { notFound } from '#utils/http';

export const createBugReport = base.bugReport.create
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const { description, metadata, page, subject } = input;
    const user = context.user;

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
      throw new ORPCError('INTERNAL', {
        message: 'Failed to store bug report',
      });
    }

    return { id: inserted.id };
  });

export const listBugReports = base.bugReport.list
  .use(requireAuthorization(permissions.bugReportsRead))
  .handler(async ({ input }) => {
    const { dateFrom, dateTo, limit, page, search, status } = input;

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

    return { reports, total: totalResult[0]?.count ?? 0 };
  });

export const updateBugReportStatus = base.bugReport.updateStatus
  .use(requireAuthorization(permissions.bugReportsWrite))
  .handler(async ({ input }) => {
    const { id, status } = input;

    const [existing] = await db
      .select()
      .from(bugReport)
      .where(eq(bugReport.id, id));

    if (!existing) {
      throw notFound('Bug report not found');
    }

    const [updated] = await db
      .update(bugReport)
      .set({ status })
      .where(eq(bugReport.id, id))
      .returning();

    if (!updated) {
      throw notFound('Bug report not found');
    }

    return updated;
  });

export const deleteBugReport = base.bugReport.delete
  .use(requireAuthorization(permissions.bugReportsWrite))
  .handler(async ({ input }) => {
    const { id } = input;

    const [deleted] = await db
      .delete(bugReport)
      .where(eq(bugReport.id, id))
      .returning({ id: bugReport.id });

    if (!deleted) {
      throw notFound('Bug report not found');
    }

    return { id: deleted.id };
  });
