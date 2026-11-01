import { oc } from '@orpc/contract';
import {
  siteThemeResponseSchema,
  updateSiteThemeSchema,
} from '../domains/theme';
import { filcRoute } from './route';

/**
 * The site-wide seasonal skin, applied on top of the per-user light/dark
 * setting. It is a single value for the whole site, so `get` is public:
 * signed-out visitors render it, so no session is required. `update` is
 * admin-only.
 */
export const themeContract = {
  get: oc
    .route(
      filcRoute({
        description:
          'Read the site-wide seasonal theme. Public because signed-out visitors need it.',
        method: 'GET',
        operationId: 'getTheme',
        path: '/theme',
        tags: ['Theme'],
      })
    )
    .output(siteThemeResponseSchema),
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Set the site-wide seasonal theme. Admin-only.',
        method: 'PATCH',
        operationId: 'patchTheme',
        path: '/theme',
        tags: ['Theme'],
      })
    )
    .input(updateSiteThemeSchema)
    .output(siteThemeResponseSchema),
};
