import dayjsModule from 'dayjs';
import 'dayjs/locale/hu';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';

dayjsModule.extend(customParseFormat);
dayjsModule.extend(relativeTime);
dayjsModule.extend(updateLocale);
dayjsModule.locale('hu');

// BKK tells us when the next vehicle leaves, so the ticking card reads as a
// countdown ("2'"), never as a time of day.
dayjsModule.updateLocale('hu', {
  relativeTime: {
    future: '%s',
    h: 'Nincs járat',
    hh: 'Nincs járat',
    m: 'Indul!',
    mm: "%d'",
    past: 'Indul!',
    s: 'Indul!',
  },
});

/** The shared dayjs instance, configured for the ticker. */
export const dayjs = dayjsModule;
