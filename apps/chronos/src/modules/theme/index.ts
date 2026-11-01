import type { SiteTheme } from '@filcdev/api/domains/theme';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { recordActivity } from '#modules/activity-log/utils/record';
import { siteTheme } from '#modules/theme/schema';
import { base } from '#orpc';

const logger = getLogger(['chronos', 'theme']);

/**
 * The one row the table holds, or the default when it has never been set.
 * Readable without a session because signed-out visitors render the skin.
 */
export const getSiteTheme = base.theme.get.handler(async ({ context }) => {
  const [row] = await db
    .select({ theme: siteTheme.theme })
    .from(siteTheme)
    .where(eq(siteTheme.id, 'default'))
    .limit(1);

  // The column is plain text, but the only writer restricts it to the enum
  // values and the row default is `default`, so the stored value is always one
  // of them.
  const theme = (row?.theme ?? 'default') as SiteTheme;

  logger.debug('site theme read', { requestId: context.requestId, theme });

  return { theme };
});

export const updateSiteTheme = base.theme.update
  .use(requireAuthorization(permissions.rolesManage))
  .handler(async ({ context, input }) => {
    const { theme } = input;

    const [existing] = await db
      .select({ theme: siteTheme.theme })
      .from(siteTheme)
      .where(eq(siteTheme.id, 'default'))
      .limit(1);

    const before = (existing?.theme ?? 'default') as SiteTheme;

    if (before === theme) {
      logger.debug('site theme unchanged', {
        requestId: context.requestId,
        theme,
        userId: context.user?.id,
      });
      return { theme };
    }

    const [row] = await db
      .insert(siteTheme)
      .values({ id: 'default', theme, updatedBy: context.user?.id })
      .onConflictDoUpdate({
        set: { theme, updatedAt: new Date(), updatedBy: context.user?.id },
        target: siteTheme.id,
      })
      .returning({ theme: siteTheme.theme });

    logger.info('site theme updated', {
      from: before,
      requestId: context.requestId,
      to: theme,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: 'default',
      entityType: 'site-theme',
      metadata: { after: theme, before },
    });

    return { theme: row.theme as SiteTheme };
  });
