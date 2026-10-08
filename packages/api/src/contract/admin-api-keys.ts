import { oc } from '@orpc/contract';
import z from 'zod';
import {
  adminApiKeyIdParamsSchema,
  adminApiKeyListResponseSchema,
  adminApiKeySchema,
  listAdminApiKeysQuerySchema,
  updateAdminApiKeySchema,
} from '../domains/admin-api-keys';
import { filcRoute } from './route';

/**
 * The admin view over every user's API keys.
 *
 * better-auth's own api-key endpoints are session-scoped, so they can only ever
 * answer for the caller's own keys. An admin screen needs all of them, which is
 * why this is a Chronos procedure rather than a call to the better-auth client
 * plugin. It is a top-level router key because that segment is the RPC path
 * (`/api/rpc/adminApiKeys/...`).
 */
export const adminApiKeysContract = {
  delete: oc
    .route(
      filcRoute({
        auth: true,
        description: "Revoke any user's API key",
        group: 'API keys',
        method: 'DELETE',
        operationId: 'deleteAdminApiKeysByKeyId',
        path: '/admin/api-keys/{keyId}',
        successStatus: 200,
        tags: ['API keys'],
        type: '@nodata',
      })
    )
    .input(adminApiKeyIdParamsSchema)
    .output(z.object({ id: z.uuid() })),
  list: oc
    .route(
      filcRoute({
        auth: true,
        description: "List every user's API keys",
        group: 'API keys',
        method: 'GET',
        operationId: 'getAdminApiKeys',
        path: '/admin/api-keys',
        successStatus: 200,
        tags: ['API keys'],
        type: '@unit AdminApiKeyListResponse @field(.apiKeys, List<AdminApiKey>) @field(.total, Int)',
      })
    )
    .input(listAdminApiKeysQuerySchema)
    .output(adminApiKeyListResponseSchema),
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: "Enable or disable any user's API key",
        group: 'API keys',
        method: 'PATCH',
        operationId: 'patchAdminApiKeysByKeyId',
        path: '/admin/api-keys/{keyId}',
        successStatus: 200,
        tags: ['API keys'],
        type: '@unit AdminApiKey',
      })
    )
    .input(updateAdminApiKeySchema)
    .output(adminApiKeySchema),
};
