/**
 * Every literal the TV ticker shows. This app has no i18n framework — the
 * boxes are Hungarian and the navigator's campus strings come from Chronos.
 */
export const TV_STRINGS = {
  departures: {
    noDeparture: 'Nincs járat!',
    unknownRoute: '???',
  },
  error: 'Hiba történt!',
  header: {
    brand: 'PetrikTV',
  },
  loading: 'Betöltés...',
  news: {
    separator: ' • ',
  },
  roomChanges: {
    empty: 'Nincs teremcsere!',
    total: 'Összesen:',
  },
  substitutions: {
    /** A substitution whose substituter is null: the lesson was called off. */
    cancelled: 'Elmarad',
    empty: 'Nincs helyettesítés!',
    total: 'Összesen:',
  },
  table: {
    class: 'Osztály',
    classroom: 'Terem',
    from: 'Honnan',
    missing: 'Helyettes',
    teacher: 'Tanár',
    to: 'Hova',
  },
  weather: {
    unknown: '???',
  },
} as const;
