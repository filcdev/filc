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
  const handler = createRequestHandler({
    request: c.req.raw,
    createRouter: () => {
      const router = createRouter();
      router.update({
        context: {
          ...router.options.context,
          head: c.res.headers.get('x-head') || '',
        },
      });
      return router;
    },
  });

  return await handler(({ responseHeaders, router }) => {
    return renderRouterToString({
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    });
  });
});
