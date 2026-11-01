import type { SiteTheme } from '@filcdev/api/domains/theme';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
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
  .use(requireAuthentication)
  .use(requireAuthorization(permissions.rolesManage))
  .handler(async ({ context, input }) => {
    const { theme } = input;

    const [row] = await db
      .insert(siteTheme)
      .values({ id: 'default', theme, updatedBy: context.user?.id })
      .onConflictDoUpdate({
        set: { theme, updatedAt: new Date(), updatedBy: context.user?.id },
        target: siteTheme.id,
      })
      .returning({ theme: siteTheme.theme });

    logger.info('site theme updated', {
      requestId: context.requestId,
      theme,
      userId: context.user?.id,
    });

    await recordActivity(context, {
      action: 'update',
      entityId: 'default',
      entityType: 'site-theme',
      metadata: { theme },
    });

    return { theme: row.theme as SiteTheme };
  });
