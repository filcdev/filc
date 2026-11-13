# Theming

The look of the app is four layers of CSS custom properties plus one attribute
per layer. All of it lives in `@filcdev/ui`; an app opts in with two imports and
three calls, and owns no palette of its own.

## The layers, and which one wins

| layer                   | file                                                      | keyed on                   | set by                                |
| ----------------------- | --------------------------------------------------------- | -------------------------- | ------------------------------------- |
| everyday light/dark     | `packages/ui/src/styles/globals.css`                      | `:root` / `.dark`          | next-themes                           |
| the visitor's palette   | `packages/ui/src/styles/schemes.css`                      | `data-color-scheme="<id>"` | the visitor, in Settings → Appearance |
| the seasonal skin       | `packages/ui/src/styles/themes.css`                       | `data-site-theme="<id>"`   | an admin, site-wide                   |
| seasonal motifs (emoji) | `lib/site-theme-art.ts` + `components/site-theme-art.tsx` | same ids                   | the active skin                       |

Every layer declares the same ~32 token names at the same specificity
(`[attr]:not(.dark)` and `[attr].dark`), so **precedence is import order**:

```css
@import '@filcdev/ui/globals.css'; /* everyday */
@import '@filcdev/ui/schemes.css'; /* the visitor's palette */
@import '@filcdev/ui/themes.css'; /* the seasonal skin */
```

An imported stylesheet that reverses these loses the whole precedence model, so
the order is the design, not a detail.

The two attributes live on `<html>`. `default` means "no layer of my own": for a
scheme it has no block at all, and for the seasonal layer the app sets
`default` (rather than removing the attribute) when the visitor has switched
seasonal skins off — which is what lets their palette show through.

Server render vs browser: `apps/iris/src/routes/__root.tsx` writes both
attributes into the first paint from the request's own data, then **freezes**
those values (`useState`) and lets the browser own them, re-applying from the
live preferences. That is deliberate: the router re-runs `beforeLoad`
client-side without a session, so a `<html>` bound to route context would keep
writing the seasonal defaults back over them after hydration.

## Adding a built-in skin

1. `siteThemeIds` in `packages/api/src/domains/theme.ts` — the wire enum, which
   is also the picker's order (chronological).
2. A light and a dark block for the id in `themes.css` (~32 tokens each).
3. Glyphs + wash in `siteThemeArt` (`lib/site-theme-art.ts`). Optional: a skin
   with no entry simply paints no motifs.
4. Labels: `THEME_COPY` in `apps/iris/src/routes/_private/admin/theme.tsx` (a
   `Record<SiteTheme, …>`, so the build fails until the skin is named) and
   `siteTheme.<id>.name` / `.description` in **both** locale trees.

Nothing else: the admin picker, the API, the `site_theme` column (plain `text`),
the backdrop and the class colours are all data-driven from the id list.

## Adding a built-in palette

1. `colorSchemeIds` in `packages/api/src/domains/theme.ts`.
2. A light and a dark block for the id in `schemes.css`.
3. Labels under `preferences.colorSchemeId.<id>` in both locales.

The settings picker iterates the ids and renders each swatch with the palette
itself (`data-color-scheme` on the swatch), so no colours are copied into TS.
Use the palette's published values rather than derived shades — that is the
point of naming it after a known theme.

## Subject colours come along for free

The twelve timetable colours are `--class-hue-1…12` (hues only) mixed with
`--class-surface` — the active palette's card washed with its `--primary`. So a
new palette needs no class colours of its own, and a seasonal skin retints the
timetable automatically. `apps/iris/src/components/timetable/helpers.ts` maps a
stored slot index to `bg-[var(--class-N)]`; the picker shares that one list.

## Unknown ids degrade, they don't break

| where                            | behaviour                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /theme`                     | `siteThemeSchema.catch('default')` + a `warning` log with the stored value: the endpoint is in every first paint and must not 500 over one bad row |
| settings read                    | `colorSchemeSchema.catch('default')` in `withCompletePreferences`                                                                                  |
| `siteThemeArtFor(id)`            | falls back to the everyday spec (no motifs)                                                                                                        |
| attribute with no matching block | inherits `:root` / `.dark`                                                                                                                         |

## What admin-defined (custom) themes would still need

Not built, and deliberately so — but the seams are known, and nothing in the
current design fights them:

1. **A palette becomes data.** Today the values live in CSS files, which a
   runtime-defined palette cannot reach. The change that needs no new asset
   pipeline: store tokens as JSON (a table, admin CRUD, one migration), and have
   the server render the _active_ palette as a scoped style block —
   `[data-site-theme="<id>"]{…}` / `[data-color-scheme="<id>"]{…}`. The cascade,
   the precedence and every helper keep working unchanged, because the token
   names are the whole contract.
2. **The two enums widen.** `siteThemeIds` / `colorSchemeIds` are closed lists;
   custom themes need an id shape (`z.uuid()` for a row, say) while built-ins
   stay strings. When that happens the read narrowing above stops being right
   for schemes: an unknown scheme should fall back to its **stored tokens**, not
   to `default`, or a visitor's custom palette would silently disappear.
3. **Motifs** are already a per-id glyph list, so a custom skin ships its own
   emoji alongside its tokens in the same row.
4. **Labels** for a custom skin/palette are user data, not `t()` keys — the
   picker would show the stored name and fall back to `t()` for built-ins.

Until something needs that, a theme is a code change — a focused one, in the
places listed above.
