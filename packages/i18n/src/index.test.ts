import { describe, expect, test } from 'bun:test';
import { createTranslator, normalizeLocale } from './index';

describe('normalizeLocale', () => {
  test('resolves the BCP-47 primary tag', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale(' EN-us ')).toBe('en');
  });

  test('anything that is not English is Hungarian', () => {
    expect(normalizeLocale('hu')).toBe('hu');
    expect(normalizeLocale('hu-HU')).toBe('hu');
    expect(normalizeLocale('de')).toBe('hu');
    expect(normalizeLocale('')).toBe('hu');
    expect(normalizeLocale(undefined)).toBe('hu');
  });
});

describe('createTranslator', () => {
  test('returns the requested language', () => {
    expect(createTranslator('en')('substitution.title')).toBe(
      'New Substitution'
    );
    expect(createTranslator('hu')('substitution.title')).toBe(
      'Új helyettesítés'
    );
  });

  test('falls back to Hungarian for an unknown or missing locale', () => {
    expect(createTranslator('de')('substitution.title')).toBe(
      'Új helyettesítés'
    );
    expect(createTranslator(undefined)('substitution.title')).toBe(
      'Új helyettesítés'
    );
  });

  test('interpolates named values', () => {
    expect(createTranslator('en')('mail.greetingNamed', { name: 'Anna' })).toBe(
      'Dear Anna,'
    );
    expect(createTranslator('hu')('mail.greetingNamed', { name: 'Anna' })).toBe(
      'Kedves Anna!'
    );
  });

  test('caches one translator per locale', () => {
    expect(createTranslator('en')).toBe(createTranslator('en'));
    expect(createTranslator('en')).not.toBe(createTranslator('hu'));
  });
});

describe('counted substitution sentences', () => {
  test('English picks the singular and plural form', () => {
    const t = createTranslator('en');
    expect(
      t('substitution.coveringLessons', {
        count: 1,
        date: '2026-11-17',
        name: 'Kiss Anna',
      })
    ).toBe('Kiss Anna is covering 1 of your lesson on 2026-11-17.');
    expect(
      t('substitution.coveringLessons', {
        count: 2,
        date: '2026-11-17',
        name: 'Kiss Anna',
      })
    ).toBe('Kiss Anna is covering 2 of your lessons on 2026-11-17.');
    expect(
      t('substitution.affectedLessons', { count: 1, date: '2026-11-17' })
    ).toBe('A substitution on 2026-11-17 affects 1 of your lesson.');
    expect(
      t('substitution.affectedLessons', { count: 3, date: '2026-11-17' })
    ).toBe('A substitution on 2026-11-17 affects 3 of your lessons.');
    expect(
      t('substitution.teacherMulti', { count: 2, weekday: 'Wednesday' })
    ).toBe('You were assigned to substitute 2 lessons on Wednesday.');
  });

  test('Hungarian repeats the same form after a numeral', () => {
    const t = createTranslator('hu');
    expect(
      t('substitution.coveringLessons', {
        count: 1,
        date: '2026. 11. 17.',
        name: 'Kiss Anna',
      })
    ).toBe('Kiss Anna helyettesít 2026. 11. 17., 1 órádat tartja meg.');
    expect(
      t('substitution.coveringLessons', {
        count: 2,
        date: '2026. 11. 17.',
        name: 'Kiss Anna',
      })
    ).toBe('Kiss Anna helyettesít 2026. 11. 17., 2 órádat tartja meg.');
    expect(
      t('substitution.affectedLessons', { count: 3, date: '2026. 11. 17.' })
    ).toBe('Helyettesítés 2026. 11. 17. — 3 órádat érinti.');
    expect(
      t('substitution.teacherMulti', { count: 2, weekday: 'szerdán' })
    ).toBe('2 órára jelöltek ki helyettesítésre szerdán.');
  });
});

describe('moved lesson copy', () => {
  test('composes the student and teacher bodies', () => {
    const en = createTranslator('en');
    const hu = createTranslator('hu');

    expect(
      en('movedLesson.body', { location: 'Thursday, Period 2 in room 201' })
    ).toBe('Your lesson has been moved to Thursday, Period 2 in room 201.');
    expect(
      en('movedLesson.teacherBodyNamedTo', {
        location: 'Thursday, Period 2 in room 201',
        who: '12A History',
      })
    ).toBe(
      'Your 12A History lesson was moved to Thursday, Period 2 in room 201.'
    );
    expect(
      hu('movedLesson.teacherBodyNamedTo', {
        location: 'Csütörtök, 2. óra, 201 terem',
        who: '12A osztály Történelem',
      })
    ).toBe(
      'A 12A osztály Történelem órád áthelyezésre került: Csütörtök, 2. óra, 201 terem.'
    );
    expect(en('movedLesson.newTimeSlot')).toBe('a new time slot');
    expect(en('movedLesson.newTimeSlotInRoom', { room: '201' })).toBe(
      'a new time slot (in room 201)'
    );
    expect(hu('movedLesson.newTimeSlotInRoom', { room: '201' })).toBe(
      'másik időpontra (201 terem)'
    );
    // The prose location joins the slot and the room with the separator each
    // language's copy carries: a space in English, a comma in Hungarian.
    expect(
      en('movedLesson.proseLocation', {
        room: en('movedLesson.inRoom', { room: '201' }),
        time: 'Thursday, Period 2',
      })
    ).toBe('Thursday, Period 2 in room 201');
    expect(
      hu('movedLesson.proseLocation', {
        room: hu('movedLesson.inRoom', { room: '201' }),
        time: 'Csütörtök, 2. óra',
      })
    ).toBe('Csütörtök, 2. óra, 201 terem');
    expect(hu('movedLesson.multipleSuffix')).toBe(
      'Nézd meg az órárendedben a további változásokat!'
    );
  });

  test('carries the per-type mail labels', () => {
    const t = createTranslator('hu');
    expect(t('types.moved_lesson_teacher')).toBe('A te áthelyezett órád');
    expect(t('types.substitution_teacher')).toBe('Tanári helyettesítés');
    expect(t('labels.substitutedTeacher')).toBe('Helyettesített tanár');
  });
});

describe('mail chrome', () => {
  test('both locales can render the footer chrome', () => {
    const en = createTranslator('en');
    expect(en('mail.autoMessage')).toBe(
      'This is an automated message from Filc.'
    );
    expect(en('mail.unsubscribeNote')).toBe(
      'System messages from the school are still delivered.'
    );
    expect(createTranslator('hu')('mail.unsubscribeNote')).toBe(
      'Az iskola rendszerüzeneteit leiratkozás után is megkapod.'
    );
  });
});
