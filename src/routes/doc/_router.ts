import { swaggerUI } from '@hono/swagger-ui';
import { openAPIRouteHandler } from 'hono-openapi';
import { api } from '~/index';
import { docFactory } from '~/routes/doc/_factory';

export const docRouter = docFactory
  .createApp()
  .get(
    '/doc/openapi.json',
    openAPIRouteHandler(api, {
      documentation: {
        info: {
          description: 'API for consumption by the Filc app family.',
          title: 'Chronos backend API',
          version: '0.0.1',
        },
        servers: [
          { description: 'Local Server', url: 'http://localhost:3000/api' },
        ],
      },
    })
  )
  .get('/doc/swagger', swaggerUI({ url: '/api/doc/openapi.json' }));
