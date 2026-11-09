import { type SiteTheme, siteThemeSchema } from '@filcdev/api/domains/theme';
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

  // The column is plain text and the only writer restricts it to the enum, so
  // the stored value *should* be one of them. Narrow it anyway: this call is in
  // every visitor's first paint, and one bad row (a manual edit, a future
  // writer that forgets the enum) would otherwise fail the output schema and
  // take the whole page down instead of falling back to the everyday look.
  const theme = siteThemeSchema.catch('default').parse(row?.theme);

  if (row && theme !== row.theme) {
    logger.warning('site theme row is not a known skin, serving the default', {
      requestId: context.requestId,
      stored: row.theme,
    });
  }

  logger.debug('site theme read', { requestId: context.requestId, theme });

  return { theme };
});

export const updateSiteTheme = base.theme.update
  .use(requireAuthorization(permissions.siteThemeManage))
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
