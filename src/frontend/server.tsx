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
import { languageDetector } from 'hono/language';
import i18next from 'i18next';
import Backend from 'i18next-http-backend';
import { I18nextProvider } from 'react-i18next';

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
    fallbackLanguage: 'hu',
    supportedLanguages: ['en', 'hu'],
    caches: ['cookie'],
    order: ['cookie'],
    lookupCookie: 'filc-lang',
    cookieOptions: {
      path: '/',
      sameSite: 'Lax',
      maxAge: dayjs.duration(1, 'year').asSeconds(),
    },
  })
);

frontend.use('*', async (c) => {
  const lang = c.get('language');
  const origin = new URL(c.req.url).origin;

  // Create an isolated i18n instance per request and ensure namespaces are loaded before render
  const i18n = i18next.createInstance();
  await i18n.use(Backend).init({
    fallbackLng: 'hu',
    supportedLngs: ['en', 'hu'],
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    backend: {
      loadPath: `${origin}/locales/{{lng}}/{{ns}}.json`,
    },
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
    return renderRouterToStream({
      request: c.req.raw,
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
