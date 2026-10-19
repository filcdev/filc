import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import type { Resolver, Translator } from '@/utils/classroom-search';
import { orpc } from '@/utils/orpc';
import { UI_STRINGS } from '@/utils/ui-strings';

/** Campus codenames are stored per language; the box falls back to Hungarian,
 *  the kiosk's built-in language. */
export const DEFAULT_LANGUAGE = 'hu';

/** The language this box renders navigator texts in: `?lang=` on the URL, so it
 *  survives a reload; every page under `_kiosk` shares the schema. */
export function useKioskLanguage(): string {
  const { lang } = useSearch({ strict: false }) as { lang?: string };
  return lang ?? DEFAULT_LANGUAGE;
}

/**
 * Translator backed by the campus translation bundle Chronos serves for the
 * kiosk's language, falling back to the kiosk's own strings for anything the
 * bundle does not carry, and then to the codename itself, so a missing string
 * shows up as `ui.something` instead of an empty label. `{{n}}` placeholders
 * are filled from the options (i18next's own syntax, which the upstream bundles
 * use for floor numbers).
 *
 * `resolve` is the same lookup without the codename fallback: it returns
 * `fallback` when the key has no row, so callers can tell "has a row" from
 * "missing" (used to resolve the derived `classroom.desc.*` keys).
 */
export function useKioskTranslations(): {
  isError: boolean;
  isLoading: boolean;
  resolve: Resolver;
  t: Translator;
} {
  const language = useKioskLanguage();

  const query = useQuery({
    ...orpc.navigator.translations.lang.queryOptions({
      input: { lang: language },
    }),
    staleTime: 5 * 60 * 1000,
  });

  const bundle = useMemo<Record<string, string>>(
    () => query.data ?? {},
    [query.data]
  );

  const t = useCallback<Translator>(
    (key, options) => {
      let text = bundle[key] ?? UI_STRINGS[key] ?? key;

      if (options) {
        for (const [name, value] of Object.entries(options)) {
          text = text.replaceAll(`{{${name}}}`, String(value));
        }
      }

      return text;
    },
    [bundle]
  );

  const resolve = useCallback<Resolver>(
    (key, fallback) => bundle[key] ?? UI_STRINGS[key] ?? fallback,
    [bundle]
  );

  return {
    isError: query.isError,
    isLoading: query.isPending,
    resolve,
    t,
  };
}
