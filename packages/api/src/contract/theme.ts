import { oc } from '@orpc/contract';
import z from 'zod';
import { listResponse } from '../domains/list';
import {
  createThemeScheduleSchema,
  siteThemeResponseSchema,
  themeScheduleIdSchema,
  themeScheduleItemSchema,
  updateSiteThemeSchema,
  updateThemeScheduleSchema,
} from '../domains/theme';
import { filcRoute } from './route';

const THEME_TAGS = ['Theme'];

/**
 * The site-wide seasonal skin, applied on top of the per-user light/dark
 * setting. It is a single value for the whole site, so `get` is public:
 * signed-out visitors render it, so no session is required. `update` is
 * admin-only.
 *
 * `schedule` is the admin-editable annual calendar on top of that one value:
 * while a window is in season its theme wins over the manual pick. Resolution
 * happens inside `get` on every request — there is no scheduled job — so the
 * schedule endpoints only edit rows.
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
        tags: THEME_TAGS,
      })
    )
    .output(siteThemeResponseSchema),
  schedule: {
    create: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Add an annual window to the theme schedule. Windows may not overlap.',
          method: 'POST',
          operationId: 'postThemeSchedule',
          path: '/theme/schedule',
          successStatus: 201,
          tags: THEME_TAGS,
        })
      )
      .input(createThemeScheduleSchema)
      .output(themeScheduleItemSchema),
    delete: oc
      .route(
        filcRoute({
          auth: true,
          description: 'Remove an annual window from the theme schedule.',
          method: 'DELETE',
          operationId: 'deleteThemeScheduleById',
          path: '/theme/schedule/{id}',
          tags: THEME_TAGS,
        })
      )
      .input(themeScheduleIdSchema)
      .output(z.object({ id: z.uuid() })),
    list: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'List the theme schedule, earliest window first, with the row active today flagged.',
          method: 'GET',
          operationId: 'getThemeSchedule',
          path: '/theme/schedule',
          tags: THEME_TAGS,
        })
      )
      .output(listResponse(themeScheduleItemSchema)),
    update: oc
      .route(
        filcRoute({
          auth: true,
          description:
            'Edit an annual window of the theme schedule. The merged window may not overlap another row.',
          method: 'PATCH',
          operationId: 'patchThemeScheduleById',
          path: '/theme/schedule/{id}',
          tags: THEME_TAGS,
        })
      )
      .input(updateThemeScheduleSchema)
      .output(themeScheduleItemSchema),
  },
  update: oc
    .route(
      filcRoute({
        auth: true,
        description: 'Set the site-wide seasonal theme. Admin-only.',
        method: 'PATCH',
        operationId: 'patchTheme',
        path: '/theme',
        tags: THEME_TAGS,
      })
    )
    .input(updateSiteThemeSchema)
    .output(siteThemeResponseSchema),
};
