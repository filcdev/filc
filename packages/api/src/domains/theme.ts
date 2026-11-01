import z from 'zod';

/** The seasonal skins an admin can apply site-wide. `default` is the off
 *  state: every visitor keeps their own per-user light/dark setting. */
export const siteThemeIds = ['default', 'halloween', 'christmas'] as const;

export const siteThemeSchema = z.enum(siteThemeIds);

export type SiteTheme = z.infer<typeof siteThemeSchema>;

/**
 * The site-wide seasonal skin, applied on top of each visitor's per-user
 * light/dark setting (which lives in `user_preferences.theme`). This is a
 * single value for the whole site, set by an admin — not a per-user
 * preference — so `get` is public (signed-out visitors read it too) while
 * `update` is admin-only.
 */
export const siteThemeResponseSchema = z.object({ theme: siteThemeSchema });

/** Payload for an admin setting the site-wide theme. */
export const updateSiteThemeSchema = z.object({ theme: siteThemeSchema });
