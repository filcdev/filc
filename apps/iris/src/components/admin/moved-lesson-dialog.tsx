import { useForm, useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

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

type MovedLessonDialogProps = BaseDialogProps & {
  allLessons: EnrichedLesson[];
  classrooms: Classroom[];
  cohorts: Cohort[];
  days: DayDefinition[];
  item?: MovedLessonItem | null;
  onSubmit: (payload: MovedLessonCreatePayload) => Promise<void>;
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
  item,
  onOpenChange,
  onSubmit,
  open,
  periods,
}: MovedLessonDialogProps) {
  const { i18n, t } = useTranslation();
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const defaultValues = useMemo(() => initialState(item), [item]);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  const formDate = useStore(form.store, (state) => state.values.date);
  const formLessonIds = useStore(form.store, (state) => state.values.lessonIds);
  const formStartingDay = useStore(
    form.store,
    (state) => state.values.startingDay
  );
  const formStartingPeriod = useStore(
    form.store,
    (state) => state.values.startingPeriod
  );
  const formRoom = useStore(form.store, (state) => state.values.room);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(defaultValues);
    setSelectedCohort('');
  }, [defaultValues, form, open]);

  // Auto-fill target day based on selected date.
  useEffect(() => {
    if (!formDate || days.length === 0) {
      return;
    }

    const weekdayIndex = dayjs(formDate as Date | string).day();

    const matchingDay = days.find((day) =>
      isMatchingWeekday(weekdayIndex, day.name, day.short)
    );

    const matchingDayId = matchingDay?.id;

    if (formStartingDay === matchingDayId) {
      return;
    }

    form.setFieldValue('startingDay', matchingDayId);
  }, [days, form, formDate, formStartingDay]);

  const selectedWeekdayLabel = useMemo(() => {
    if (!formDate) {
      return '-';
    }

    return formatLocalizedDate(formDate as Date | string, i18n.language, {
      weekday: 'long',
    });
  }, [formDate, i18n.language]);

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
    queryKey: queryKeys.timetable.lessonsByCohort(selectedCohort),
  });

  const availableClassroomsQuery = useQuery({
    enabled: !!formDate && !!formStartingDay && !!formStartingPeriod,
    queryFn: async () => {
      const dateParam =
        formDate instanceof Date
          ? formDate.toISOString().split('T')[0]
          : String(formDate ?? '');

      const sd = formStartingDay;
      const sp = formStartingPeriod;

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
    queryKey: queryKeys.timetable.availableClassrooms(
      formDate,
      formStartingDay,
      formStartingPeriod
    ),
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
        !formStartingPeriod || l.period?.id === formStartingPeriod;
      const dayMatch = !formStartingDay || l.day?.id === formStartingDay;
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
    formStartingPeriod,
    formStartingDay,
  ]);

  const isCreate = !item;

  const isValid = useMemo(() => {
    if (isCreate) {
      return !!formDate && !!(formLessonIds && formLessonIds.length > 0);
    }
    return (
      !!formDate &&
      !!formStartingDay &&
      !!formStartingPeriod &&
      !!formRoom &&
      !!(formLessonIds && formLessonIds.length > 0)
    );
  }, [
    formDate,
    formLessonIds,
    formStartingDay,
    formStartingPeriod,
    formRoom,
    isCreate,
  ]);

  const toggleLesson = (
    lesson: EnrichedLesson | undefined,
    checked: boolean
  ) => {
    if (!lesson?.id) {
      return;
    }
    const current = form.getFieldValue('lessonIds') ?? [];
    if (checked) {
      const newLessonIds = Array.from(new Set([...current, lesson.id]));
      form.setFieldValue('lessonIds', newLessonIds);
      // Auto-fill period/day if not already set
      if (!form.getFieldValue('startingPeriod') && lesson.period?.id) {
        form.setFieldValue('startingPeriod', lesson.period.id);
      }
      if (!form.getFieldValue('startingDay') && lesson.day?.id) {
        form.setFieldValue('startingDay', lesson.day.id);
      }
    } else {
      form.setFieldValue(
        'lessonIds',
        current.filter((id) => id !== lesson.id)
      );
    }
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
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className="space-y-2">
              <Label>{t('movedLesson.date')}</Label>
              <DatePicker
                date={
                  formDate instanceof Date
                    ? formDate
                    : new Date(String(formDate))
                }
                onDateChange={(d) => form.setFieldValue('date', d ?? formDate)}
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
                    form.setFieldValue('startingPeriod', value || undefined)
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
                  value={formStartingPeriod ?? ''}
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
                  form.setFieldValue('room', value || undefined)
                }
                options={
                  formDate && formStartingDay && formStartingPeriod
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
                value={formRoom ?? ''}
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
                          checked={(formLessonIds ?? []).includes(
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
            disabled={!isValid || form.state.isSubmitting}
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
