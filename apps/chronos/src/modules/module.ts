import type { NotificationHandler } from '#utils/notifications/types';

/**
 * A cron entry a module contributes to the shared baker. Matches the shape
 * `baker.add` takes, narrowed to the three fields a scheduled job needs.
 */
export type ModuleJob = {
  callback: () => Promise<void> | void;
  cron: string;
  name: string;
};

/**
 * What one module contributes to the application, beyond its `_router.ts`.
 *
 * The router is deliberately *not* here: `src/router.ts` keeps spelling every
 * feature out in a literal so `base.router({...})` fails to compile when a
 * procedure is missing, extra or mistyped. Everything below that has no such
 * static guarantee is declared by the module and collected here, so adding a
 * feature never means editing `utils/cron.ts` or the notification engine by
 * hand.
 *
 * Tables are not declared here either: `src/modules/schemas.ts` holds those,
 * because `src/database/index.ts` constructs `db` at module load and must not
 * pull a module's notification handlers — and through them the engine that
 * queries `db` — into an import cycle.
 *
 * Both fields are optional. A feature with no scheduled work and no
 * notifications contributes nothing and simply has no `_module.ts`.
 */
export type Module = {
  /** Scheduled work, registered on the shared cronbake baker at boot. */
  jobs?: readonly ModuleJob[];
  /** Notification handlers, registered on the engine at boot. */
  notifications?: readonly NotificationHandler[];
};
