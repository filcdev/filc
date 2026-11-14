/** Where a sign-in lands when no usable return path was carried. */
const DEFAULT_RETURN_TO = '/';

/**
 * Only used to parse the incoming path; any origin works, because the parsed
 * target is compared against this one rather than against the live page. That
 * keeps the check available outside a browser, where `window` does not exist.
 */
const RESOLUTION_ORIGIN = 'http://filc.invalid';

/**
 * A same-origin path to return to after signing in, or `/`.
 *
 * An absolute path is required, so `?redirect=1` is rejected rather than
 * resolved against the current URL into `/1`. The origin comparison (rather
 * than the naive `startsWith('/') && !startsWith('//')` prefix check) rejects
 * the rest: the URL parser normalises backslashes and strips tabs/newlines, so
 * `/\evil.com` and the same path with a literal tab collapse into a different
 * origin.
 */
export function resolveReturnTo(redirect: string | undefined): string {
  if (!redirect?.startsWith('/')) {
    return DEFAULT_RETURN_TO;
  }
  try {
    const target = new URL(redirect, RESOLUTION_ORIGIN);
    if (target.origin !== RESOLUTION_ORIGIN) {
      return DEFAULT_RETURN_TO;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

/**
 * Absolute URL of `path` carrying the return path as `?redirect=`, for the
 * better-auth redirect options that have to survive the OAuth round trip.
 */
export function callbackUrlWithRedirect(
  path: string,
  returnTo: string
): string {
  const url = new URL(path, window.location.origin);
  if (returnTo !== DEFAULT_RETURN_TO) {
    url.searchParams.set('redirect', returnTo);
  }
  return url.href;
}
