import { doorlockModule } from '#modules/doorlock/_module';
import type { Module } from '#modules/module';
import { newsModule } from '#modules/news/_module';
import { notificationsModule } from '#modules/notifications/_module';
import { timetableModule } from '#modules/timetable/_module';

/**
 * Every module that contributes scheduled work or notifications.
 *
 * This is the one list a new feature adds itself to for behaviour. The routers
 * deliberately are not here: `src/router.ts` spells each feature out in a
 * literal so `base.router({...})` still fails to compile when a procedure is
 * missing, extra or mistyped, which no dynamically assembled list could do.
 * Tables live in `src/modules/schemas.ts` instead, which the database can
 * import without dragging runtime behaviour in with it.
 *
 * A feature with nothing to contribute (a read-only view, a health probe)
 * simply has no `_module.ts` and does not appear below.
 */
export const modules: readonly Module[] = [
  doorlockModule,
  newsModule,
  notificationsModule,
  timetableModule,
];
