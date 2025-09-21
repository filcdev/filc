import {
  createRequestHandler,
  RouterServer,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { compress } from 'hono/compress';
import { createRouter } from '~/frontend/router';
import { env } from '~/utils/environment';
// TODO: remove when bun supports CompressionStream
import '@ungap/compression-stream/poly';
import i18next from 'i18next';
import Backend from 'i18next-http-backend';
import { I18nextProvider } from 'react-i18next';

export const frontend = new Hono();

if (env.mode === 'production') {
  frontend.use(compress());

  frontend.use(
    '/assets/*',
    serveStatic({
      root: './dist/client/static',
    })
  );

  // TODO:
  // With this commented, the prod build sends a request for a file in here,
  // but it 404s. Need to investigate why and fix it.
  // This is likely related to Vite's handling of assets.
  // frontend.use(
  //   '/assets/*',
  //   serveStatic({
  //     root: './dist/server/',
  //   })
  // );

  frontend.use(
    '*',
    serveStatic({
      root: './dist/client',
    })
  );
} else {
  frontend.use(
    '*',
    serveStatic({
      root: './public',
    })
  );
}

frontend.use('*', async (c) => {
  // Detect language from cookie or Accept-Language header
  const supported = ['en', 'hu'] as const;
  type Lang = (typeof supported)[number];
  const cookieHeader = c.req.header('cookie') || '';
  const cookies: Record<string, string> = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf('=');
        if (idx === -1) {
          return [pair, ''];
        }
        return [
          decodeURIComponent(pair.slice(0, idx)),
          decodeURIComponent(pair.slice(idx + 1)),
        ];
      })
  );
  const accept = c.req.header('accept-language') || '';
  const pickFromAccept = (): Lang | undefined => {
    for (const part of accept.split(',').map((s) => s.trim())) {
      const code = part.split(';')[0]?.toLowerCase();
      if (!code) {
        continue;
      }
      // Match full code or primary subtag
      const primary = code.split('-')[0] as Lang;
      if (supported.includes(code as Lang)) {
        return code as Lang;
      }
      if (supported.includes(primary)) {
        return primary;
      }
    }
    return 'hu';
  };
  const langCookie = cookies.i18next as Lang | undefined;
  const lang: Lang = (langCookie || pickFromAccept() || 'hu') as Lang;

  const origin = new URL(c.req.url).origin;

  // Create an isolated i18n instance per request and ensure namespaces are loaded before render
  const i18n = i18next.createInstance();
  await i18n.use(Backend).init({
    fallbackLng: 'hu',
    supportedLngs: supported as unknown as string[],
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    backend: {
      loadPath: `${origin}/locales/{{lng}}/{{ns}}.json`,
    },
    // Disable React suspense on server by default; react-i18next reads this
    // This option is read by react-i18next to avoid Suspense on server
    react: { useSuspense: false },
    initImmediate: false,
  });

  await i18n.changeLanguage(lang);
  await new Promise<void>((resolve, reject) =>
    i18n.loadNamespaces(['translation'], (err) =>
      err ? reject(err) : resolve()
    )
  );

  const handler = createRequestHandler({
    request: c.req.raw,
    createRouter: () => {
      const router = createRouter();
      router.update({
        context: {
          ...router.options.context,
          i18n,
          head: c.res.headers.get('x-head') || '',
        },
      });
      return router;
    },
  });

  return await handler(({ responseHeaders, router }) => {
    // Persist chosen language for the client-side detector
    // responseHeaders.set('set-cookie', `i18next=${lang}; Path=/; SameSite=Lax`);

    return renderRouterToString({
      responseHeaders,
      router,
      children: (
        <I18nextProvider i18n={i18n}>
          <RouterServer router={router} />
        </I18nextProvider>
      ),
    });
  });
});
