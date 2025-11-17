import {
  createRequestHandler,
  RouterServer,
  renderRouterToStream,
} from '@tanstack/react-router/ssr/server';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { compress } from 'hono/compress';
import { createRouter } from '~/frontend/router';
import { env } from '~/utils/environment';
// TODO: remove when bun supports CompressionStream
import '@ungap/compression-stream/poly';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { languageDetector } from 'hono/language';
import i18next from 'i18next';
import Backend from 'i18next-http-backend';
import { Cookies, CookiesProvider } from 'react-cookie';
import { I18nextProvider } from 'react-i18next';

dayjs.extend(duration);

export const frontend = new Hono();

if (env.mode === 'production') {
  frontend.use(compress());

  frontend.use(
    '/assets/*',
    serveStatic({
      root: './dist/server',
    })
  );

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

frontend.use(
  languageDetector({
    caches: ['cookie'],
    cookieOptions: {
      maxAge: dayjs.duration(1, 'year').asSeconds(),
      path: '/',
      sameSite: 'Lax',
    },
    fallbackLanguage: 'hu',
    lookupCookie: 'filc-lang',
    order: ['cookie'],
    supportedLanguages: ['en', 'hu'],
  })
);

frontend.use('*', async (c) => {
  const lang = c.get('language');
  const origin = new URL(c.req.url).origin;

  // Create an isolated i18n instance per request and ensure namespaces are loaded before render
  const i18n = i18next.createInstance();
  await i18n.use(Backend).init({
    backend: {
      loadPath: `${origin}/locales/{{lng}}/{{ns}}.json`,
    },
    defaultNS: 'translation',
    fallbackLng: 'hu',
    initImmediate: false,
    interpolation: { escapeValue: false },
    ns: ['translation'],
    react: { useSuspense: false },
    supportedLngs: ['en', 'hu'],
  });

  await i18n.changeLanguage(lang);
  await new Promise<void>((resolve, reject) =>
    i18n.loadNamespaces(['translation'], (err) =>
      err ? reject(err) : resolve()
    )
  );

  const handler = createRequestHandler({
    createRouter: () => {
      const router = createRouter();
      router.update({
        context: {
          ...router.options.context,
          head: c.res.headers.get('x-head') || '',
          i18n,
        },
      });
      return router;
    },
    request: c.req.raw,
  });

  const cookies = new Cookies(c.req.raw.headers.get('cookie'));

  return await handler(({ responseHeaders, router }) =>
    renderRouterToStream({
      children: (
        <I18nextProvider i18n={i18n}>
          <CookiesProvider cookies={cookies} defaultSetOptions={{ path: '/' }}>
            <RouterServer router={router} />
          </CookiesProvider>
        </I18nextProvider>
      ),
      request: c.req.raw,
      responseHeaders,
      router,
    })
  );
});
