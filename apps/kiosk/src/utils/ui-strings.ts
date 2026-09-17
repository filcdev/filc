/**
 * The kiosk's own interface strings, in Hungarian.
 *
 * Chronos is the editable copy and wins: a `navigator_translation` row can
 * reword or add anything, and the Iris translations page is where a school
 * changes them. These built-ins only make sure a box still renders words —
 * never `ui.something` — when the bundle it fetches is missing or incomplete.
 * Campus names come from the database alone.
 */
export const UI_STRINGS: Record<string, string> = {
  'kiosk.location.marker': 'Itt vagy',
  'ui.card.navigate': 'Navigálás',
  'ui.common.delete': 'Törlés',
  'ui.common.less': 'Kevesebb',
  'ui.common.loading': 'Betöltés...',
  'ui.common.more': 'Több',
  'ui.common.no_data': 'Nincs megjeleníthető adat',
  'ui.common.no_results': 'Nincs találat',
  'ui.common.search_placeholder': 'Keresés...',
  'ui.common.unknown': 'Ismeretlen',
  'ui.common.unknown_type': 'Ismeretlen típus',
  'ui.floor.basement': '{{n}}. alagsor',
  'ui.floor.ground': 'Földszint',
  'ui.floor.upper': '{{n}}. emelet',
  'ui.highlighter.title': 'Kiemelés típus szerint',
  'ui.keyboard.close': 'Bezárás',
  'ui.keyboard.close_aria': 'Billentyűzet bezárása',
  'ui.keyboard.space': 'Szóköz',
  'ui.kiosk.clear_highlight': 'Kiemelés törlése',
  'ui.kiosk.error': 'Hiba történt: {{error}}',
  'ui.kiosk.loading': 'Betöltés...',

  'ui.kiosk.reset': 'Visszaállítás',
  'ui.kiosk.scan_to_open': 'Nyisd meg a telefonodon!',
  'ui.navigate.back': 'Vissza',
  'ui.navigate.barrier_free': 'Akadálymentes útvonal',
  'ui.navigate.choose_room': 'Válassz termet',
  'ui.navigate.destination': 'Cél:',
  'ui.navigate.my_position': 'Jelenlegi helyem',
  'ui.navigate.needs_start': 'Válassz kiindulási pontot az útvonalhoz.',
  'ui.navigate.no_route': 'Nincs útvonal a két pont között.',
  'ui.navigate.start': 'Indulás:',
  'ui.navigate.title': 'Navigáció',
  'ui.search.placeholder': 'Keresés név vagy típus szerint...',
};
