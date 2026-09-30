import startServer from './dist/server/server.js';

/**
 * The production server: the built Start handler for pages, and the client
 * assets it does not serve itself.
 *
 * `/api` belongs to Chronos and is routed there by the platform proxy, so it
 * is answered here with a 404 rather than a page — a server render that reached
 * the API through this process would fetch it from itself, forever.
 */
const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  fetch: async (request) => {
    const { pathname } = new URL(request.url);

    if (pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    if (pathname !== '/') {
      const asset = Bun.file(`dist/client${pathname}`);
      if (await asset.exists()) {
        return new Response(asset);
      }
    }

    return startServer.fetch(request);
  },
  port,
});
