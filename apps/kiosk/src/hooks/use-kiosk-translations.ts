import { useCallback } from 'react';
import { api, useApiQuery } from '@/utils/api';
import type { Translator } from '@/utils/classroom-search';
import { UI_STRINGS } from '@/utils/ui-strings';

/** The kiosk speaks Hungarian; the campus codenames are stored per language. */
const LANGUAGE = 'hu';

/**
 * Translator backed by the campus translation bundle Chronos serves for the
 * kiosk's language, falling back to the kiosk's own strings for anything the
 * bundle does not carry, and then to the codename itself, so a missing string
 * shows up as `ui.something` instead of an empty label. `{{n}}` placeholders
 * are filled from the options (i18next's own syntax, which the upstream bundles
 * use for floor numbers).
 */
export function useKioskTranslations(): {
  isError: boolean;
  isLoading: boolean;
  t: Translator;
} {
  const query = useApiQuery<Record<string, string>>(
    () => api.navigator.translations.lang.$get({ query: { lang: LANGUAGE } }),
    {
      queryKey: ['navigator', 'translations', LANGUAGE],
      staleTime: 5 * 60 * 1000,
    }
  );

  const bundle = query.data ?? {};

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

  return { isError: query.isError, isLoading: query.isPending, t };
}
