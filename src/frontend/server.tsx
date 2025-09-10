import {
  createRequestHandler,
  RouterServer,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server';
import { Hono } from 'hono';
import { createRouter } from '.';

export const frontend = new Hono();

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
