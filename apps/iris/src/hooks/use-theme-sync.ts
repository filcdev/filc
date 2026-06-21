import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';
import { useCookies } from 'react-cookie';

const THEME_COOKIE_NAME = 'filc.theme';
const THEME_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * Syncs the next-themes theme with:
 * - a cookie for instant initial load (avoids flash of wrong theme)
 * - the DB preference (handled by settings dialog save)
 *
 * On mount, reads the cookie to set the initial theme.
 * On theme change, updates the cookie.
 */
export function useThemeSync(dbTheme: string | undefined) {
  const { setTheme, theme } = useTheme();
  const [cookies, setCookie] = useCookies([THEME_COOKIE_NAME]);
  const initialized = useRef(false);

  // Apply initial theme from cookie or DB (runs once)
  useEffect(() => {
    if (initialized.current) {
      return;
    }
    initialized.current = true;

    const cookieTheme = cookies[THEME_COOKIE_NAME];
    if (cookieTheme) {
      setTheme(cookieTheme);
    } else if (dbTheme) {
      setTheme(dbTheme);
    }
  }, [cookies, dbTheme, setTheme]);

  // When DB theme loads and no cookie exists yet, apply it
  useEffect(() => {
    if (dbTheme && !cookies[THEME_COOKIE_NAME]) {
      setTheme(dbTheme);
    }
  }, [dbTheme, cookies, setTheme]);

  // Keep cookie in sync when theme changes
  useEffect(() => {
    if (theme) {
      setCookie(THEME_COOKIE_NAME, theme, {
        maxAge: THEME_COOKIE_MAX_AGE,
        sameSite: 'lax',
      });
    }
  }, [theme, setCookie]);

  return { theme };
}
