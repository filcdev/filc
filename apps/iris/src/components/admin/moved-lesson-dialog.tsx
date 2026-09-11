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
import { Textarea } from '@/components/ui/textarea';
import {
  type Classroom,
  type Cohort,
  type DayDefinition,
  type EnrichedLesson,
  type MovedLessonItem,
  useCreateMovedLesson,
  useUpdateMovedLesson,
} from '@/hooks/moved-lessons';
import { useApiQuery } from '@/utils/api';
import { isMatchingWeekday } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { formatPeriodLabel } from '@/utils/period';
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
};

// Cohort entries can arrive as plain names (from substitutions/moved lessons)
// or as objects (from the per-cohort lessons endpoint); normalise for display.
type CohortLike = string | { id: string; name: string; short?: string };

type LessonForLabel = {
  id: string;
  classrooms?: Array<{ name?: string; short?: string }>;
  cohorts?: CohortLike[];
  period?: {
    startTime?: string | null;
    endTime?: string | null;
    period?: number | null;
  } | null;
  subject?: { name?: string; short?: string } | null;
  teachers?: Array<{ name?: string; short?: string }>;
};

function formatLessonLabel(lesson: LessonForLabel): string {
  const parts: string[] = [];

  if (lesson.period?.startTime && lesson.period?.endTime) {
    parts.push(formatPeriodLabel(lesson.period));
  }

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

// Map a calendar date to the id of the day definition matching its weekday.
function getWeekdayId(date: Date, days: DayDefinition[]): string {
  const weekdayIndex = date.getDay(); // 0 = Sunday … 6 = Saturday
  return (
    days.find((day) => isMatchingWeekday(weekdayIndex, day.name, day.short))
      ?.id ?? ''
  );
}

// Map a day definition id back to a JS weekday index (0 = Sunday … 6 = Saturday).
function getWeekdayIndex(dayId: string, days: DayDefinition[]): number {
  const day = days.find((d) => d.id === dayId);
  if (!day) {
    return -1;
  }
  for (let index = 0; index < 7; index += 1) {
    if (isMatchingWeekday(index, day.name, day.short)) {
      return index;
    }
  }
  return -1;
}

// Lessons on the source day, de-duplicated by id. A day move lists every
// lesson on the day (optionally narrowed to a selected class); a room move
// narrows to the selected from-room.
function filterVisibleLessons(
  allLessons: EnrichedLesson[],
  sourceDay: string,
  fromRoom: string,
  mode: MoveMode,
  cohortName: string
): EnrichedLesson[] {
  if (!sourceDay) {
    return [];
  }
  if (mode === 'room' && !fromRoom) {
    return [];
  }

  const seen = new Map<string, EnrichedLesson>();
  for (const lesson of allLessons) {
    const matchesDay = lesson.day?.id === sourceDay;
    const matchesRoom =
      mode === 'day' || lesson.classrooms?.some((cr) => cr.id === fromRoom);
    // cohorts can arrive as plain names (from substitutions) or objects (from
    // the per-cohort lessons endpoint); normalise each before comparing.
    const cohorts = lesson.cohorts as CohortLike[];
    const matchesCohort =
      mode !== 'day' ||
      !cohortName ||
      cohorts.some((cohort) => {
        const name = typeof cohort === 'string' ? cohort : cohort.name;
        return name === cohortName;
      });
    if (matchesDay && matchesRoom && matchesCohort && !seen.has(lesson.id)) {
      seen.set(lesson.id, lesson);
    }
  }

  return Array.from(seen.values());
}

function slotHintKey(mode: MoveMode): string {
  return mode === 'day'
    ? 'movedLesson.selectDayHint'
    : 'movedLesson.selectSlotHint';
}

type MovedLessonFormValues = InferRequestType<
  typeof api.timetable.movedLessons.$post
>['json'];

const initialState = (
  item?: MovedLessonItem | null
): MovedLessonFormValues => ({
  comment: item?.movedLesson.comment ?? null,
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

type CohortSelectorProps = {
  cohorts: Cohort[];
  onChange: (value: string) => void;
  value: string;
};

function CohortSelector({ cohorts, onChange, value }: CohortSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t('movedLesson.class')}</Label>
      <Combobox
        emptyMessage={t('movedLesson.noCohortFound')}
        onValueChange={onChange}
        options={cohorts.map((cohort) => ({
          label: `${cohort.name} (${cohort.short})`,
          value: cohort.name,
        }))}
        placeholder={t('movedLesson.selectCohortPlaceholder')}
        searchPlaceholder={t('search')}
        value={value}
      />
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: two move modes share many conditional fields
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
}: MovedLessonDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const createMutation = useCreateMovedLesson({ onSaved: close });
  const updateMutation = useUpdateMovedLesson({ onSaved: close });

  const [fromRoom, setFromRoom] = useState<string>('');
  const [sourceDate, setSourceDate] = useState<Date | undefined>();
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  const defaultValues = useMemo(() => initialState(item), [item]);

  // The source weekday id is derived from the source date.
  const sourceDay = useMemo(
    () => (sourceDate ? getWeekdayId(sourceDate, days) : ''),
    [sourceDate, days]
  );

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
            comment: value.comment ?? null,
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
  const formRoom = useStore(form.store, (state) => state.values.room);

  // The period selector is gone, so the target period is the first selected
  // lesson's current period (the slot it sits in).
  const selectedPeriodId = useMemo(() => {
    const firstId = (formLessonIds ?? [])[0];
    if (!firstId) {
      return '';
    }
    return allLessons.find((lesson) => lesson.id === firstId)?.period?.id ?? '';
  }, [allLessons, formLessonIds]);

  // Reset the form and derive the source slot whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(defaultValues);

    let sourceWeekdayId = '';
    let fromRoomId = '';

    if (item && item.lessons.length > 0) {
      const firstLesson = item.lessons[0];
      sourceWeekdayId = firstLesson?.day?.id ?? '';
      fromRoomId = firstLesson?.classrooms?.[0]?.id ?? '';
    }

    setFromRoom(fromRoomId);
    setSelectedCohort('');

    // The source date is the lesson's date. For a room move the move's own
    // date already lands on the source weekday; otherwise anchor on it and
    // shift to the source weekday so the derived weekday stays correct.
    const anchor = item?.movedLesson.date
      ? new Date(item.movedLesson.date)
      : new Date();
    const weekdayIndex = sourceWeekdayId
      ? getWeekdayIndex(sourceWeekdayId, days)
      : anchor.getDay();
    const initialSourceDate = new Date(anchor);
    initialSourceDate.setDate(
      anchor.getDate() + ((weekdayIndex - anchor.getDay() + 7) % 7)
    );
    setSourceDate(initialSourceDate);
  }, [days, defaultValues, form, item, open]);

  // In room-move mode the target slot is the source slot.
  useEffect(() => {
    if (mode !== 'room') {
      return;
    }
    if (sourceDay && form.getFieldValue('startingDay') !== sourceDay) {
      form.setFieldValue('startingDay', sourceDay);
    }
    if (sourceDate) {
      const currentDate = form.getFieldValue('date');
      if (
        !(currentDate instanceof Date) ||
        currentDate.getTime() !== sourceDate.getTime()
      ) {
        form.setFieldValue('date', sourceDate);
      }
    }
  }, [form, mode, sourceDate, sourceDay]);

  // Keep the target period in sync with the selected lesson's period.
  useEffect(() => {
    if (
      selectedPeriodId &&
      form.getFieldValue('startingPeriod') !== selectedPeriodId
    ) {
      form.setFieldValue('startingPeriod', selectedPeriodId);
    }
  }, [form, selectedPeriodId]);

  const availableClassroomsQuery = useApiQuery<Classroom[]>(
    () => {
      const dateParam =
        formDate instanceof Date
          ? formDate.toISOString().split('T')[0]
          : String(formDate ?? '');

      const sd = formStartingDay;
      const sp = selectedPeriodId;

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
      enabled: !!formDate && !!formStartingDay && !!selectedPeriodId,
      queryKey: queryKeys.timetable.availableClassrooms(
        formDate,
        formStartingDay,
        selectedPeriodId
      ),
    }
  );

  // Lessons in the selected source slot (de-duplicated by lesson id). A day
  // move lists every lesson on the day; a room move narrows to the from-room.
  const visibleLessons = useMemo(
    () =>
      filterVisibleLessons(
        allLessons,
        sourceDay,
        fromRoom,
        mode,
        selectedCohort
      ),
    [allLessons, sourceDay, fromRoom, mode, selectedCohort]
  );

  const availabilityKnown = Boolean(
    formDate && formStartingDay && selectedPeriodId
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
      !!selectedPeriodId &&
      !!(formLessonIds && formLessonIds.length > 0)
    );
  }, [formDate, formLessonIds, formRoom, formStartingDay, selectedPeriodId]);

  // Whether the lessons list has enough context to render: a day always, plus
  // a from-room in room-move mode.
  const hasSlotContext =
    mode === 'day' ? Boolean(sourceDay) : Boolean(sourceDay && fromRoom);

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

  const handleSourceDateChange = (date: Date | undefined) => {
    setSourceDate(date);
    form.setFieldValue('lessonIds', []);
  };

  const handleFromRoomChange = (value: string) => {
    setFromRoom(value);
    form.setFieldValue('lessonIds', []);
  };

  const handleCohortChange = (value: string) => {
    setSelectedCohort(value);
    form.setFieldValue('lessonIds', []);
  };

  const handleTargetDateChange = (date: Date | undefined) => {
    if (!date) {
      form.setFieldValue('date', undefined);
      form.setFieldValue('startingDay', undefined);
      return;
    }
    form.setFieldValue('date', date);
    form.setFieldValue('startingDay', getWeekdayId(date, days));
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
                date={sourceDate}
                onDateChange={handleSourceDateChange}
                placeholder={t('movedLesson.datePlaceholder')}
              />
            </div>

            {mode === 'day' && (
              <CohortSelector
                cohorts={cohorts}
                onChange={handleCohortChange}
                value={selectedCohort}
              />
            )}

            {mode === 'room' && (
              <div className="space-y-2">
                <Label>{t('movedLesson.fromRoom')}</Label>
                <Combobox
                  emptyMessage={t('movedLesson.noRoomFound')}
                  onValueChange={handleFromRoomChange}
                  options={classrooms.map((c) => ({
                    label: `${c.name} (${c.short})`,
                    value: c.id,
                  }))}
                  placeholder={t('movedLesson.fromRoom')}
                  searchPlaceholder={t('search')}
                  value={fromRoom}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('movedLesson.lessons')}</Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border">
                <div className="space-y-1 p-2">
                  {!hasSlotContext && (
                    <p className="p-2 text-muted-foreground text-sm">
                      {t(slotHintKey(mode))}
                    </p>
                  )}
                  {hasSlotContext && visibleLessons.length === 0 && (
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
              <div className="space-y-2">
                <Label>{t('movedLesson.targetDate')}</Label>
                <DatePicker
                  date={formDate instanceof Date ? formDate : undefined}
                  onDateChange={handleTargetDateChange}
                  placeholder={t('movedLesson.datePlaceholder')}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('movedLesson.toRoom')}</Label>
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
                placeholder={t('movedLesson.toRoom')}
                searchPlaceholder={t('search')}
                value={formRoom ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="moved-lesson-comment">
                {t('movedLesson.comment')}
              </Label>
              <form.Field name="comment">
                {(field) => (
                  <Textarea
                    id="moved-lesson-comment"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder={t('movedLesson.commentPlaceholder')}
                    value={field.state.value ?? ''}
                  />
                )}
              </form.Field>
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
