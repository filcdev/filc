import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { Save } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  formatLocalizedDate,
  getDayOrder,
  getLocalizedWeekdayName,
  isMatchingWeekday,
} from '@/utils/date-locale';
import { api } from '@/utils/hc';

type MovedLessonApiResponse = InferResponseType<
  typeof api.timetable.movedLessons.$get
>;
type MovedLessonItem = NonNullable<MovedLessonApiResponse['data']>[number];
type Classroom = Omit<
  NonNullable<MovedLessonItem['classroom']>,
  'createdAt' | 'updatedAt'
>;
type Period = Omit<
  NonNullable<MovedLessonItem['period']>,
  'createdAt' | 'updatedAt'
>;
type DayDefinition = Omit<
  NonNullable<MovedLessonItem['dayDefinition']>,
  'createdAt' | 'updatedAt'
>;

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionItem = NonNullable<SubstitutionApiResponse['data']>[number];
type EnrichedLesson = NonNullable<SubstitutionItem['lessons'][number]>;

type CohortApiResponse = InferResponseType<typeof api.cohort.index.$get>;
type Cohort = NonNullable<CohortApiResponse['data']>[number];

const create = api.timetable.movedLessons.$post;
type MovedLessonCreatePayload = InferRequestType<typeof create>['json'];

type MovedLessonDialogProps = {
  allLessons: EnrichedLesson[];
  classrooms: Classroom[];
  cohorts: Cohort[];
  days: DayDefinition[];
  isSubmitting: boolean;
  item?: MovedLessonItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: MovedLessonCreatePayload) => Promise<void>;
  open: boolean;
  periods: Period[];
};

function formatLessonLabel(
  lesson: EnrichedLesson,
  language: string | undefined
): string {
  const parts: string[] = [];
  if (lesson.subject) {
    parts.push(lesson.subject.short);
  }
  if (lesson.day) {
    parts.push(
      getLocalizedWeekdayName(
        lesson.day.name,
        lesson.day.short,
        language,
        'short'
      )
    );
  }
  if (lesson.period) {
    parts.push(`P${lesson.period.period}`);
  }
  if (lesson.cohorts && lesson.cohorts.length > 0) {
    parts.push(`(${lesson.cohorts.join(', ')})`);
  }
  return parts.join(' - ') || lesson.id;
}

const initialState = (
  item?: MovedLessonItem | null
): MovedLessonCreatePayload => ({
  date: item?.movedLesson.date ? new Date(item.movedLesson.date) : new Date(),
  lessonIds: item?.lessons ?? [],
  room: item?.movedLesson.room || undefined,
  startingDay: item?.movedLesson.startingDay || undefined,
  startingPeriod: item?.movedLesson.startingPeriod || undefined,
});

export function MovedLessonDialog({
  allLessons,
  classrooms,
  cohorts,
  days,
  isSubmitting,
  item,
  onOpenChange,
  onSubmit,
  open,
  periods,
}: MovedLessonDialogProps) {
  const { i18n, t } = useTranslation();
  const [formState, setFormState] = useState<MovedLessonCreatePayload>(
    initialState(item)
  );
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  useEffect(() => {
    setFormState(initialState(item));
    setSelectedCohort('');
  }, [item]);

  // Auto-fill target day based on selected date.
  useEffect(() => {
    if (!formState.date || days.length === 0) {
      return;
    }

    const weekdayIndex = dayjs(formState.date as Date | string).day(); // 0 = Sunday, 1 = Monday, etc.

    const matchingDay = days.find((day) =>
      isMatchingWeekday(weekdayIndex, day.name, day.short)
    );

    if (matchingDay) {
      setFormState((prev) => ({
        ...prev,
        startingDay: matchingDay.id,
      }));
      return;
    }

    setFormState((prev) => ({
      ...prev,
      startingDay: undefined,
    }));
  }, [formState.date, days]);

  const selectedWeekdayLabel = useMemo(() => {
    if (!formState.date) {
      return '-';
    }

    return formatLocalizedDate(formState.date as Date | string, i18n.language, {
      weekday: 'long',
    });
  }, [formState.date, i18n.language]);

  const cohortLessonsQuery = useQuery({
    enabled: !!selectedCohort,
    queryFn: async () => {
      const res = await parseResponse(
        api.timetable.lessons.getForCohort[':cohortId'].$get({
          param: { cohortId: selectedCohort },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load lessons');
      }
      return res.data;
    },
    queryKey: ['lessons', 'cohort', selectedCohort],
  });

  const availableClassroomsQuery = useQuery({
    enabled:
      !!formState.date && !!formState.startingDay && !!formState.startingPeriod,
    queryFn: async () => {
      const dateParam =
        formState.date instanceof Date
          ? formState.date.toISOString().split('T')[0]
          : String(formState.date ?? '');

      const sd = formState.startingDay;
      const sp = formState.startingPeriod;

      if (!(sd && sp)) {
        return [];
      }

      const res = await parseResponse(
        api.timetable.classrooms.getAvailable.$get({
          query: {
            date: dateParam as string,
            startingDay: sd,
            startingPeriod: sp,
          },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load available classrooms');
      }
      return res.data;
    },
    queryKey: [
      'classrooms',
      'available',
      formState.date,
      formState.startingDay,
      formState.startingPeriod,
    ],
  });

  const availableLessons = useMemo(() => {
    const map = new Map<string, EnrichedLesson>();
    const source = selectedCohort
      ? (cohortLessonsQuery.data ?? [])
      : allLessons;
    /* biome-disable useBlockStatements */
    for (const l of source) {
      if (!l?.id) {
        continue;
      }
      map.set(l.id, l as EnrichedLesson);
    }
    /* biome-enable useBlockStatements */

    let lessons = Array.from(map.values());

    lessons = lessons.filter((l) => {
      const periodMatch =
        !formState.startingPeriod || l.period?.id === formState.startingPeriod;
      const dayMatch =
        !formState.startingDay || l.day?.id === formState.startingDay;
      return periodMatch && dayMatch;
    });

    return lessons.sort((a, b) => {
      const aDay = getDayOrder(a.day?.name ?? '', a.day?.short);
      const bDay = getDayOrder(b.day?.name ?? '', b.day?.short);

      if (aDay !== bDay) {
        return aDay - bDay;
      }

      return (a.period?.period ?? 999) - (b.period?.period ?? 999);
    });
  }, [
    allLessons,
    cohortLessonsQuery.data,
    selectedCohort,
    formState.startingPeriod,
    formState.startingDay,
  ]);

  const isCreate = !item;

  const isValid = useMemo(() => {
    // CREATE esetén csak date és lessonIds kötelező
    if (isCreate) {
      if (!formState.date) {
        return false;
      }
      if (!formState.lessonIds || formState.lessonIds.length === 0) {
        return false;
      }
      return true;
    }

    // UPDATE esetén minden kötelező
    if (
      !(
        formState.date &&
        formState.startingDay &&
        formState.startingPeriod &&
        formState.room
      )
    ) {
      return false;
    }
    if (!formState.lessonIds || formState.lessonIds.length === 0) {
      return false;
    }
    return true;
  }, [formState, isCreate]);

  const toggleLesson = (
    lesson: EnrichedLesson | undefined,
    checked: boolean
  ) => {
    if (!lesson?.id) {
      return;
    }
    setFormState((prev) => {
      const currentLessonIds = prev.lessonIds ?? [];
      if (checked) {
        const newState: MovedLessonCreatePayload = {
          ...prev,
          lessonIds: Array.from(new Set([...currentLessonIds, lesson.id])),
        };
        // Auto-fill period/day if not already set
        if (!prev.startingPeriod && lesson.period?.id) {
          newState.startingPeriod = lesson.period.id;
        }
        if (!prev.startingDay && lesson.day?.id) {
          newState.startingDay = lesson.day.id;
        }
        return newState;
      }
      return {
        ...prev,
        lessonIds: currentLessonIds.filter((id) => id !== lesson.id),
      };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) {
      return;
    }
    await onSubmit(formState);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {isCreate ? t('movedLesson.create') : t('movedLesson.edit')}
            </DialogTitle>
          </DialogHeader>
          <form
            className="mt-4 space-y-4"
            id="movedLessonForm"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label>{t('movedLesson.date')}</Label>
              <DatePicker
                date={
                  formState.date instanceof Date
                    ? formState.date
                    : new Date(String(formState.date))
                }
                onDateChange={(d) =>
                  setFormState((prev) => ({
                    ...prev,
                    date: d ?? prev.date,
                  }))
                }
                placeholder={t('movedLesson.datePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('movedLesson.targetDay')}</Label>
                <div className="rounded-md border px-3 py-2 text-sm capitalize">
                  {selectedWeekdayLabel}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('movedLesson.targetPeriod')}</Label>
                <Combobox
                  emptyMessage={t('movedLesson.noPeriodFound')}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      startingPeriod: value || undefined,
                    }))
                  }
                  options={periods.map((p) => ({
                    label: t('movedLesson.periodLabel', {
                      end: p.endTime.slice(0, 5),
                      num: p.period,
                      start: p.startTime.slice(0, 5),
                    }),
                    value: p.id,
                  }))}
                  placeholder={t('movedLesson.targetPeriod')}
                  searchPlaceholder={t('search')}
                  value={formState.startingPeriod ?? ''}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('movedLesson.targetRoom')}</Label>
              <Combobox
                className={
                  availableClassroomsQuery.isLoading
                    ? 'pointer-events-none opacity-50'
                    : undefined
                }
                emptyMessage={
                  availableClassroomsQuery.isLoading
                    ? t('movedLesson.loadingRooms')
                    : t('movedLesson.noRoomFound')
                }
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    room: value || undefined,
                  }))
                }
                options={
                  formState.date &&
                  formState.startingDay &&
                  formState.startingPeriod
                    ? (availableClassroomsQuery.data ?? []).map((cr) => ({
                        label: `${cr.name} (${cr.short})`,
                        value: cr.id,
                      }))
                    : classrooms.map((cr) => ({
                        label: `${cr.name} (${cr.short})`,
                        value: cr.id,
                      }))
                }
                placeholder={t('movedLesson.targetRoom')}
                searchPlaceholder={t('search')}
                value={formState.room ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('movedLesson.selectCohort')}</Label>
              <Combobox
                emptyMessage={t('movedLesson.noCohortFound')}
                onValueChange={(v) => setSelectedCohort(v)}
                options={cohorts.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
                placeholder={t('movedLesson.selectCohortPlaceholder')}
                searchPlaceholder={t('search')}
                value={selectedCohort}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('movedLesson.lessons')}</Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <div className="space-y-1 p-2">
                  {cohortLessonsQuery.isLoading && (
                    <p className="p-2 text-muted-foreground text-sm">
                      {t('movedLesson.loadingLessons')}
                    </p>
                  )}
                  {!cohortLessonsQuery.isLoading &&
                    availableLessons.length === 0 && (
                      <p className="p-2 text-muted-foreground text-sm">
                        {t('movedLesson.noLessons')}
                      </p>
                    )}
                  {!cohortLessonsQuery.isLoading &&
                    availableLessons.length > 0 &&
                    availableLessons.map((lesson) => (
                      <label
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                        htmlFor={`ml-lesson-${lesson.id}`}
                        key={lesson.id}
                      >
                        <Checkbox
                          checked={(formState.lessonIds ?? []).includes(
                            lesson.id ?? ''
                          )}
                          id={`ml-lesson-${lesson.id}`}
                          onCheckedChange={(checked) =>
                            toggleLesson(lesson, !!checked)
                          }
                        />
                        <span>{formatLessonLabel(lesson, i18n.language)}</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
          </form>
        </div>

        <DialogFooter className="border-t p-4">
          <Button
            disabled={!isValid || isSubmitting}
            form="movedLessonForm"
            type="submit"
          >
            <Save className="mr-2 h-4 w-4" />
            {isCreate ? t('movedLesson.create') : t('movedLesson.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
