import z from 'zod';

/** The seasonal skins an admin can apply site-wide. `default` is the off
 *  state: every visitor keeps their own per-user light/dark setting. */
export const siteThemeIds = [
  'default',
  'newYear',
  'valentines',
  'march15',
  'easter',
  'summer',
  'halloween',
  'christmas',
] as const;

export const siteThemeSchema = z.enum(siteThemeIds);

export type SiteTheme = z.infer<typeof siteThemeSchema>;

/**
 * The colour palettes a visitor can pick for their own account. They sit
 * between the everyday light/dark tokens and the seasonal skins in precedence:
 * a scheme recolours the whole app in the visitor's taste, and an active
 * seasonal skin paints over it (see `siteThemeEnabled` on the user
 * preferences).
 *
 * The ids are also the `data-color-scheme` attribute values the design system's
 * `schemes.css` is keyed on, so adding one here means adding its palette there
 * — and a `colorScheme.*` label to both locale trees.
 */
export const colorSchemeIds = [
  'default',
  'catppuccin',
  'dracula',
  'gruvbox',
  'nord',
  'rosePine',
  'solarized',
  'tokyoNight',
] as const;

export const colorSchemeSchema = z.enum(colorSchemeIds);

export type ColorScheme = z.infer<typeof colorSchemeSchema>;

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

/** An annual schedule window is a month/day pair without a year, so 1–12 and
 *  1–31 are the wire bounds; the backend rejects impossible pairs (31 April). */
export const monthSchema = z.number().int().min(1).max(12);
export const daySchema = z.number().int().min(1).max(31);

/**
 * A row of the admin-editable annual schedule: while the window is in season,
 * its theme overrides the manually pinned `site_theme.theme`. `active` is
 * computed server-side against today's wall clock (`env.timeZone`) on every
 * read — it is not stored and never editable.
 */
export const themeScheduleItemSchema = z.object({
  active: z
    .boolean()
    .describe(
      "True when today (in the school's time zone) falls inside this row's annual window. Computed per request, not stored."
    ),
  endDay: daySchema,
  endMonth: monthSchema,
  id: z.uuid(),
  startDay: daySchema,
  startMonth: monthSchema,
  theme: siteThemeSchema,
});

/** Payload for adding a schedule window. Windows must not overlap. */
export const createThemeScheduleSchema = z.object({
  endDay: daySchema,
  endMonth: monthSchema,
  startDay: daySchema,
  startMonth: monthSchema,
  theme: siteThemeSchema,
});

/** Partial edit of one schedule window; `id` rides in the path. */
export const updateThemeScheduleSchema = createThemeScheduleSchema
  .partial()
  .extend({ id: z.uuid() });

/** Path/query input of the endpoints that address one schedule row. */
export const themeScheduleIdSchema = z.object({ id: z.uuid() });
