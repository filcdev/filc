import { bugReportSchema } from '#modules/bug-report/schema';
import { doorlockSchema } from '#modules/doorlock/schema';
import { kioskSchema } from '#modules/kiosk/schema';
import { navigatorSchema } from '#modules/navigator/schema';
import { newsSchema } from '#modules/news/schema';
import { notificationsSchema } from '#modules/notifications/schema';
import { timetableSchema } from '#modules/timetable/schema';
import { wifiSchema } from '#modules/wifi/schema';

/**
 * Every module's tables, merged into the one schema map Drizzle is built from.
 *
 * This list is separate from `modules` because it has to be importable on its
 * own: `src/database/index.ts` constructs `db` at module load, so pulling it
 * in must not drag a module's notification handlers — and through them the
 * notification engine, which queries `db` — back into the cycle. Schema files
 * import nothing but other schemas and the column helpers, so this list stays
 * a leaf.
 *
 * A module with tables adds itself here; a module with scheduled work or
 * notifications adds itself to `modules`.
 */
export const moduleSchemas = {
  ...bugReportSchema,
  ...doorlockSchema,
  ...kioskSchema,
  ...navigatorSchema,
  ...newsSchema,
  ...notificationsSchema,
  ...timetableSchema,
  ...wifiSchema,
};
