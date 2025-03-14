import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express';
import { appRouter, createTRPCContext } from "@filc/api";

const app = express();

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext: () => createTRPCContext({
      headers: new Headers(),
      session: null,
    }),
  }),
);

app.listen(4000);