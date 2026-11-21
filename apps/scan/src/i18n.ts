/**
 * The scanner's own copy.
 *
 * Deliberately not `@filcdev/i18n`: that package is the server-side
 * notification catalogue with i18next behind it, and this app needs two
 * languages and no runtime loader. A typed record gives the same key parity
 * with a fraction of the setup, and `hu` is checked against `en`'s keys.
 */
const en = {
  appName: 'Door check-in',
  cameraDenied:
    'Camera access is not allowed. Enter the code on the ticket below.',
  cameraStarting: 'Starting the camera…',
  cameraUnavailable:
    'The camera cannot start on this device. Enter the code on the ticket below.',
  changeEvent: 'Change event',
  checkFailed: 'The check-in did not complete. Try again.',
  checkingIn: 'Checking…',
  localeSwitch: 'Switch language',
  manualLabel: 'Code on the ticket',
  manualPlaceholder: 'Paste or type the code',
  manualSubmit: 'Check',
  noAccessBody:
    'Check-in needs the events:checkin permission or an approved helper grant for the event. Ask an administrator to add the permission to your role, or an organizer to approve your helper signup.',
  noAccessTitle: 'No check-in permission',
  pickerEmpty: 'There is no event to check in.',
  pickerGrantUntil: 'Door check-in until {date}',
  pickerLoadError: 'The events could not be loaded.',
  pickerLoading: 'Loading events…',
  pickerRetry: 'Retry',
  pickerSubtitle: 'Only the events you may check in are listed.',
  pickerTitle: 'Pick an event',
  resultAdmitted: 'Admitted',
  resultAdmittedHint: 'Checked in just now.',
  resultAlready: 'Already checked in',
  resultAlreadyHint: 'First checked in {time} by {name}.',
  resultDetails: 'More information',
  resultDetailsClose: 'Close',
  resultInvalid: 'Not valid',
  resultInvalidHint: 'This registration was cancelled.',
  resultNext: 'Next',
  resultNotFound: 'Not found',
  resultNotFoundHint: 'No ticket for this event has this code.',
  resultNotGranted: 'May not enter',
  resultNotGrantedHint: 'The door rules do not allow this registration in.',
  resultVisitor: 'Visitor',
  retryCamera: 'Retry camera',
  signedInAs: 'Signed in as {name}',
  signInButton: 'Sign in with Microsoft',
  signInError: 'Sign-in did not complete. Try again.',
  signInLoading: 'Signing in…',
  signInSubtitle: 'Checking guests in needs your Filc account.',
  signInTitle: 'Sign in',
  signOut: 'Sign out',
} as const;

/** The shape both catalogues share: every `en` key, each a string. */
export type ScanStrings = Record<keyof typeof en, string>;

const hu: ScanStrings = {
  appName: 'Beléptetés',
  cameraDenied: 'A kamera nem engedélyezett. Írd be a jegy kódját lent.',
  cameraStarting: 'Kamera indítása…',
  cameraUnavailable:
    'A kamera nem indítható ezen az eszközön. Írd be a jegy kódját lent.',
  changeEvent: 'Másik esemény',
  checkFailed: 'Az ellenőrzés nem sikerült. Próbáld újra.',
  checkingIn: 'Ellenőrzés…',
  localeSwitch: 'Nyelv váltása',
  manualLabel: 'Kód a jegyen',
  manualPlaceholder: 'Illeszd be vagy írd be a kódot',
  manualSubmit: 'Ellenőrzés',
  noAccessBody:
    'A beléptetéshez az events:checkin jogosultság vagy egy jóváhagyott segítői jogosultság kell az adott eseményre. Kérd meg az adminisztrátort, hogy adja a szerepkörödhöz a jogosultságot, vagy a szervezőt, hogy hagyja jóvá a segítőjelentkezésedet.',
  noAccessTitle: 'Nincs beléptetési jogosultság',
  pickerEmpty: 'Nincs beléptethető esemény.',
  pickerGrantUntil: 'Beléptetés eddig: {date}',
  pickerLoadError: 'Az események betöltése nem sikerült.',
  pickerLoading: 'Események betöltése…',
  pickerRetry: 'Újra',
  pickerSubtitle: 'Csak a beléptethető események jelennek meg.',
  pickerTitle: 'Válassz eseményt',
  resultAdmitted: 'Beléphet',
  resultAdmittedHint: 'Sikeres beléptetés.',
  resultAlready: 'Már belépett',
  resultAlreadyHint: 'Első beléptetés: {time}, {name}.',
  resultDetails: 'További adatok',
  resultDetailsClose: 'Bezárás',
  resultInvalid: 'Érvénytelen jegy',
  resultInvalidHint: 'Ezt a regisztrációt lemondták.',
  resultNext: 'Következő',
  resultNotFound: 'Nincs ilyen jegy',
  resultNotFoundHint: 'Erre az eseményre nincs ilyen kódú jegy.',
  resultNotGranted: 'Nem léphet be',
  resultNotGrantedHint:
    'A beléptetési szabályok szerint ez a regisztráció nem léphet be.',
  resultVisitor: 'Vendég',
  retryCamera: 'Kamera újrapróbálása',
  signedInAs: 'Bejelentkezve: {name}',
  signInButton: 'Bejelentkezés Microsoft-fiókkal',
  signInError: 'A bejelentkezés nem sikerült. Próbáld újra.',
  signInLoading: 'Bejelentkezés…',
  signInSubtitle: 'A beléptetéshez a Filc-fiókodra van szükség.',
  signInTitle: 'Jelentkezz be',
  signOut: 'Kijelentkezés',
};

export const strings = { en, hu };

export type ScanLocale = keyof typeof strings;

/** Hungarian for a Hungarian browser, English for everyone else. */
export const detectLocale = (): ScanLocale =>
  navigator.language.toLowerCase().startsWith('hu') ? 'hu' : 'en';

/** `{name}`-style placeholders in a catalogue line. */
const PLACEHOLDER = /\{(\w+)\}/g;

export const fill = (
  template: string,
  values: Record<string, string>
): string =>
  template.replace(PLACEHOLDER, (match, key: string) => values[key] ?? match);

const formatters: Record<ScanLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }),
  hu: new Intl.DateTimeFormat('hu-HU', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }),
};

/** The RPC transport hands dates back as `Date`; a string is tolerated too. */
export const formatWhen = (value: Date | string, locale: ScanLocale): string =>
  formatters[locale].format(
    typeof value === 'string' ? new Date(value) : value
  );
