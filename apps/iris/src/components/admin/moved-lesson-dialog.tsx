import { useForm, useStore } from '@tanstack/react-form';
import type { InferRequestType } from 'hono/client';
import { ArrowRightLeft, Save } from 'lucide-react';
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
  type Classroom,
  type Cohort,
  type DayDefinition,
  type EnrichedLesson,
  type MovedLessonItem,
  type Period,
  useCreateMovedLesson,
  useUpdateMovedLesson,
} from '@/hooks/moved-lessons';
import { useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

export type MoveMode = 'room' | 'day';

type MovedLessonDialogProps = BaseDialogProps & {
  allLessons: EnrichedLesson[];
  classrooms: Classroom[];
  cohorts: Cohort[];
  days: DayDefinition[];
  item?: MovedLessonItem | null;
  mode?: MoveMode;
  onModeChange?: (mode: MoveMode) => void;
  periods: Period[];
};

// Cohort entries can arrive as plain names (from substitutions/moved lessons)
// or as objects (from the per-cohort lessons endpoint); normalise for display.
type CohortLike = string | { id: string; name: string; short?: string };

type LessonForLabel = {
  id: string;
  classrooms?: Array<{ name?: string; short?: string }>;
  cohorts?: CohortLike[];
  subject?: { name?: string; short?: string } | null;
  teachers?: Array<{ name?: string; short?: string }>;
};

// Drizzle `time` columns are serialised as strings, but keep formatting
// defensive so a non-string value can never crash the render.
function formatTime(value: string | undefined): string {
  return String(value ?? '').slice(0, 5);
}

function formatLessonLabel(lesson: LessonForLabel): string {
  const parts: string[] = [];

  if (lesson.subject?.short) {
    parts.push(lesson.subject.short);
  }

  if (lesson.cohorts && lesson.cohorts.length > 0) {
    const cohortLabels = lesson.cohorts.map((c) =>
      typeof c === 'string' ? c : (c.short ?? c.name ?? '')
    );
    parts.push(`(${cohortLabels.join(', ')})`);
  }

  if (lesson.classrooms && lesson.classrooms.length > 0) {
    parts.push(lesson.classrooms.map((cr) => cr.name ?? '').join(', '));
  }

  if (lesson.teachers && lesson.teachers.length > 0) {
    parts.push(lesson.teachers.map((t) => t.name ?? '').join(', '));
  }

  return parts.join(' · ') || lesson.id;
}

type MovedLessonFormValues = InferRequestType<
  typeof api.timetable.movedLessons.$post
>['json'];

const initialState = (
  item?: MovedLessonItem | null
): MovedLessonFormValues => ({
  date: item?.movedLesson.date ? new Date(item.movedLesson.date) : new Date(),
  lessonIds: item?.lessons.map((lesson) => lesson.id) ?? [],
  room: item?.movedLesson.room || undefined,
  startingDay: item?.movedLesson.startingDay || undefined,
  startingPeriod: item?.movedLesson.startingPeriod || undefined,
});

type MoveModeToggleProps = {
  mode: MoveMode;
  onChange: (mode: MoveMode) => void;
};

function MoveModeToggle({ mode, onChange }: MoveModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 space-y-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="font-medium text-sm">{t('movedLesson.moveMode')}</p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onChange('room')}
          size="sm"
          variant={mode === 'room' ? 'default' : 'outline'}
        >
          {t('movedLesson.roomMove')}
        </Button>
        <Button
          onClick={() => onChange('day')}
          size="sm"
          variant={mode === 'day' ? 'default' : 'outline'}
        >
          {t('movedLesson.dayMove')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {mode === 'room'
          ? t('movedLesson.roomMoveHint')
          : t('movedLesson.dayMoveHint')}
      </p>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: mode, source and target fields plus availability queries
export function MovedLessonDialog({
  allLessons,
  classrooms,
  cohorts,
  days,
  item,
  mode = 'room',
  onModeChange,
  onOpenChange,
  open,
  periods,
}: MovedLessonDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const createMutation = useCreateMovedLesson({ onSaved: close });
  const updateMutation = useUpdateMovedLesson({ onSaved: close });

  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [sourceDay, setSourceDay] = useState<string>('');
  const [sourcePeriod, setSourcePeriod] = useState<string>('');

  const defaultValues = useMemo(() => initialState(item), [item]);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (item) {
        // Updates require every target field to be present.
        const hasAllFields =
          Boolean(value.room) &&
          Boolean(value.startingDay) &&
          Boolean(value.startingPeriod);
        if (!hasAllFields) {
          throw new Error('All fields are required for updates');
        }
        await updateMutation.mutateAsync({
          id: item.movedLesson.id,
          payload: {
            date: value.date,
            lessonIds: value.lessonIds ?? [],
            room: value.room as string,
            startingDay: value.startingDay as string,
            startingPeriod: value.startingPeriod as string,
          },
        });
      } else {
        await createMutation.mutateAsync(value);
      }
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

  // Reset the form and derive the source slot whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(defaultValues);

    let dayId = '';
    let periodId = '';

    if (item && item.lessons.length > 0) {
      const firstLesson = item.lessons[0];
      dayId = firstLesson?.day?.id ?? '';
      periodId = firstLesson?.period?.id ?? '';
    }

    setSelectedCohort('');
    setSourceDay(dayId);
    setSourcePeriod(periodId);
  }, [defaultValues, form, item, open]);

  // In room-move mode the target slot is the source slot.
  useEffect(() => {
    if (mode !== 'room') {
      return;
    }
    if (sourceDay && form.getFieldValue('startingDay') !== sourceDay) {
      form.setFieldValue('startingDay', sourceDay);
    }
    if (sourcePeriod && form.getFieldValue('startingPeriod') !== sourcePeriod) {
      form.setFieldValue('startingPeriod', sourcePeriod);
    }
  }, [form, mode, sourceDay, sourcePeriod]);

  const cohortLessonsQuery = useApiQuery<EnrichedLesson[]>(
    () =>
      api.timetable.lessons.getForCohort[':cohortId'].$get({
        param: { cohortId: selectedCohort },
        query: {},
      }),
    {
      enabled: !!selectedCohort,
      queryKey: queryKeys.timetable.lessonsByCohort(selectedCohort),
    }
  );

  const availableClassroomsQuery = useApiQuery<Classroom[]>(
    () => {
      const dateParam =
        formDate instanceof Date
          ? formDate.toISOString().split('T')[0]
          : String(formDate ?? '');

      const sd = formStartingDay;
      const sp = formStartingPeriod;

      if (!(sd && sp)) {
        return [] as never;
      }

      return api.timetable.classrooms.getAvailable.$get({
        query: {
          date: dateParam as string,
          startingDay: sd,
          startingPeriod: sp,
        },
      });
    },
    {
      enabled: !!formDate && !!formStartingDay && !!formStartingPeriod,
      queryKey: queryKeys.timetable.availableClassrooms(
        formDate,
        formStartingDay,
        formStartingPeriod
      ),
    }
  );

  // Lessons in the selected source slot (de-duplicated by lesson id, since the
  // per-cohort endpoint can return the same lesson once per group).
  const visibleLessons = useMemo(() => {
    if (!(sourceDay && sourcePeriod)) {
      return [];
    }

    const source =
      selectedCohort && cohortLessonsQuery.data?.length
        ? cohortLessonsQuery.data
        : allLessons;

    const seen = new Map<string, EnrichedLesson>();
    for (const lesson of source) {
      if (
        lesson?.day?.id === sourceDay &&
        lesson?.period?.id === sourcePeriod &&
        !seen.has(lesson.id)
      ) {
        seen.set(lesson.id, lesson);
      }
    }

    return Array.from(seen.values());
  }, [
    allLessons,
    cohortLessonsQuery.data,
    selectedCohort,
    sourceDay,
    sourcePeriod,
  ]);

  const availabilityKnown = Boolean(
    formDate && formStartingDay && formStartingPeriod
  );

  const roomOptions = useMemo(() => {
    const freeRoomIds = new Set(
      (availableClassroomsQuery.data ?? []).map((cr) => cr.id)
    );

    // The room currently assigned to the edited move is never "occupied" by it.
    if (item?.movedLesson.room) {
      freeRoomIds.add(item.movedLesson.room);
    }

    return classrooms.map((cr) => {
      const isFree = !availabilityKnown || freeRoomIds.has(cr.id);
      const label = availabilityKnown
        ? `${cr.name} (${cr.short}) — ${
            isFree ? t('movedLesson.free') : t('movedLesson.occupied')
          }`
        : `${cr.name} (${cr.short})`;
      return {
        disabled: availabilityKnown && !freeRoomIds.has(cr.id),
        label,
        value: cr.id,
      };
    });
  }, [availableClassroomsQuery.data, availabilityKnown, classrooms, item, t]);

  const isCreate = !item;

  const isValid = useMemo(() => {
    return (
      !!formDate &&
      !!formRoom &&
      !!formStartingDay &&
      !!formStartingPeriod &&
      !!(formLessonIds && formLessonIds.length > 0)
    );
  }, [formDate, formLessonIds, formRoom, formStartingDay, formStartingPeriod]);

  const toggleLesson = (lesson: EnrichedLesson, checked: boolean) => {
    const current = form.getFieldValue('lessonIds') ?? [];
    if (checked) {
      form.setFieldValue(
        'lessonIds',
        Array.from(new Set([...current, lesson.id]))
      );
    } else {
      form.setFieldValue(
        'lessonIds',
        current.filter((id) => id !== lesson.id)
      );
    }
  };

  const handleSourceDayChange = (value: string) => {
    setSourceDay(value);
    form.setFieldValue('lessonIds', []);
  };

  const handleSourcePeriodChange = (value: string) => {
    setSourcePeriod(value);
    form.setFieldValue('lessonIds', []);
  };

  const handleModeChange = (next: MoveMode) => {
    onModeChange?.(next);
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

          <MoveModeToggle mode={mode} onChange={handleModeChange} />

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

            <div className="space-y-2">
              <Label>{t('movedLesson.class')}</Label>
              <Combobox
                emptyMessage={t('movedLesson.noCohortFound')}
                onValueChange={setSelectedCohort}
                options={cohorts.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
                placeholder={t('movedLesson.selectCohortPlaceholder')}
                searchPlaceholder={t('search')}
                value={selectedCohort}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('movedLesson.day')}</Label>
                <Combobox
                  emptyMessage={t('movedLesson.noDayFound')}
                  onValueChange={handleSourceDayChange}
                  options={days.map((day) => ({
                    label: `${day.name} (${day.short})`,
                    value: day.id,
                  }))}
                  placeholder={t('movedLesson.selectDayPlaceholder')}
                  searchPlaceholder={t('search')}
                  value={sourceDay}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('movedLesson.period')}</Label>
                <Combobox
                  emptyMessage={t('movedLesson.noPeriodFound')}
                  onValueChange={handleSourcePeriodChange}
                  options={periods.map((p) => ({
                    label: t('movedLesson.periodLabel', {
                      end: formatTime(p.endTime),
                      num: p.period,
                      start: formatTime(p.startTime),
                    }),
                    value: p.id,
                  }))}
                  placeholder={t('movedLesson.selectPeriodPlaceholder')}
                  searchPlaceholder={t('search')}
                  value={sourcePeriod}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('movedLesson.lessons')}</Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <div className="space-y-1 p-2">
                  {!(sourceDay && sourcePeriod) && (
                    <p className="p-2 text-muted-foreground text-sm">
                      {t('movedLesson.selectSlotHint')}
                    </p>
                  )}
                  {sourceDay &&
                    sourcePeriod &&
                    cohortLessonsQuery.isLoading && (
                      <p className="p-2 text-muted-foreground text-sm">
                        {t('movedLesson.loadingLessons')}
                      </p>
                    )}
                  {sourceDay &&
                    sourcePeriod &&
                    !cohortLessonsQuery.isLoading &&
                    visibleLessons.length === 0 && (
                      <p className="p-2 text-muted-foreground text-sm">
                        {t('movedLesson.noLessons')}
                      </p>
                    )}
                  {visibleLessons.map((lesson) => (
                    <label
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      htmlFor={`ml-lesson-${lesson.id}`}
                      key={lesson.id}
                    >
                      <Checkbox
                        checked={(formLessonIds ?? []).includes(lesson.id)}
                        id={`ml-lesson-${lesson.id}`}
                        onCheckedChange={(checked) =>
                          toggleLesson(lesson, !!checked)
                        }
                      />
                      <span>
                        {formatLessonLabel(lesson as unknown as LessonForLabel)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {mode === 'day' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('movedLesson.targetDay')}</Label>
                  <Combobox
                    emptyMessage={t('movedLesson.noDayFound')}
                    onValueChange={(value) =>
                      form.setFieldValue('startingDay', value || undefined)
                    }
                    options={days.map((day) => ({
                      label: `${day.name} (${day.short})`,
                      value: day.id,
                    }))}
                    placeholder={t('movedLesson.targetDay')}
                    searchPlaceholder={t('search')}
                    value={formStartingDay ?? ''}
                  />
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
                        end: formatTime(p.endTime),
                        num: p.period,
                        start: formatTime(p.startTime),
                      }),
                      value: p.id,
                    }))}
                    placeholder={t('movedLesson.targetPeriod')}
                    searchPlaceholder={t('search')}
                    value={formStartingPeriod ?? ''}
                  />
                </div>
              </div>
            )}

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
                options={roomOptions}
                placeholder={t('movedLesson.targetRoom')}
                searchPlaceholder={t('search')}
                value={formRoom ?? ''}
              />
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
