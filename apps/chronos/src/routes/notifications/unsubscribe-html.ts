import { unsubscribeSchema } from '@filcdev/api/domains/notifications';
import { db } from '#database';
import { userPreferences } from '#database/schema/notifications';
import { generateUnsubscribeToken } from '#utils/notifications/providers/smtp';

/**
 * `GET|POST /api/notifications/unsubscribe`: the two HTML pages the
 * unsubscribe link in an email lands on. Deliberately outside the oRPC
 * contract — the browser posts an HTML form and renders the result, and the
 * page is the whole response. `src/index.ts` dispatches the path here before
 * the RPC/OpenAPI handlers.
 */

/** HTML-escape a string for interpolation into markup (e.g. reflected tokens). */
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

export async function handleUnsubscribe(request: Request): Promise<Response> {
  const params =
    request.method === 'POST'
      ? new URLSearchParams(await request.text())
      : new URL(request.url).searchParams;

  const parsed = unsubscribeSchema.safeParse(Object.fromEntries(params));

  const invalidTokenHtml = `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="utf-8"><title>Hiba - Filc</title></head>
<body><h1>Érvénytelen leiratkozási token</h1><p>A token érvénytelen vagy lejárt.</p></body>
</html>`;

  if (!parsed.success) {
    return new Response(invalidTokenHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    });
  }

  const { token, userId } = parsed.data;

  if (request.method !== 'POST') {
    const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leiratkozás - Filc</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
    h1 { margin: 0 0 16px; font-size: 24px; }
    p { color: #666; margin: 0 0 24px; }
    button { background: #d93025; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; }
    button:hover { background: #c62828; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Leiratkozás az értesítésekről</h1>
    <p>Szeretnéd lemondani az összes email értesítést a Filc rendszertől? Ezután nem fogsz több emailt kapni.</p>
    <form method="POST" action="/api/notifications/unsubscribe">
      <input type="hidden" name="userId" value="${escapeHtml(userId)}">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <button type="submit">Leiratkozás</button>
    </form>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const expected = generateUnsubscribeToken(userId);
  if (expected !== token) {
    return new Response(invalidTokenHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 400,
    });
  }

  const allDisabled = {
    announcement: false,
    blogPost: false,
    channelsEnabled: false,
    doorlockCardUsed: false,
    movedLesson: false,
    substitution: false,
    systemMessage: false,
  };

  await db
    .insert(userPreferences)
    .values({ notificationPreferences: allDisabled, userId })
    .onConflictDoUpdate({
      set: { notificationPreferences: allDisabled },
      target: userPreferences.userId,
    });

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sikeres leiratkozás - Filc</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
    h1 { margin: 0 0 16px; font-size: 24px; color: #2e7d32; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sikeres leiratkozás</h1>
    <p>Innentől nem fogsz email értesítéseket kapni a Filc rendszertől.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
