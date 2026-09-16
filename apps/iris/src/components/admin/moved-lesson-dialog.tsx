import { unwrapResponse } from '@filcdev/api/client';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Combobox } from '@filcdev/ui/components/combobox';
import { DatePicker } from '@filcdev/ui/components/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import { Textarea } from '@filcdev/ui/components/textarea';
import { useForm, useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { type InferRequestType, parseResponse } from 'hono/client';
import { ArrowRightLeft, CircleAlert, Save } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Classroom,
  type Cohort,
  type DayDefinition,
  type EnrichedLesson,
  type MovedLessonItem,
  type Subject,
  type Teacher,
  useCreateManualMovedLesson,
  useCreateMovedLesson,
  useCreateMovedLessonsBatch,
  useMovedLessonSubjects,
  useMovedLessonTeachers,
  useUpdateMovedLesson,
} from '@/hooks/moved-lessons';
import { getIntlLocale, isMatchingWeekday } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { formatPeriodLabel } from '@/utils/period';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

export type MoveMode = 'room' | 'day' | 'manual';

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

type Period = NonNullable<EnrichedLesson['period']>;

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

// Sortable class label for a lesson, normalising cohorts that can arrive as
// plain names or objects.
function cohortLabel(cohorts: CohortLike[] | undefined): string {
  if (!cohorts?.length) {
    return '';
  }
  return cohorts
    .map((cohort) =>
      typeof cohort === 'string' ? cohort : (cohort.short ?? cohort.name ?? '')
    )
    .join(', ');
}

// Order lessons by period number ascending (unknown periods last), breaking
// ties by subject short then class so same-period lessons group sensibly.
function compareLessonsByPeriod(a: EnrichedLesson, b: EnrichedLesson): number {
  const aPeriod = a.period?.period ?? Number.POSITIVE_INFINITY;
  const bPeriod = b.period?.period ?? Number.POSITIVE_INFINITY;
  if (aPeriod !== bPeriod) {
    return aPeriod - bPeriod;
  }
  const aSubject = a.subject?.short ?? a.subject?.name ?? '';
  const bSubject = b.subject?.short ?? b.subject?.name ?? '';
  const subjectDiff = aSubject.localeCompare(bSubject);
  if (subjectDiff !== 0) {
    return subjectDiff;
  }
  return cohortLabel(a.cohorts as CohortLike[]).localeCompare(
    cohortLabel(b.cohorts as CohortLike[])
  );
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

  return Array.from(seen.values()).sort(compareLessonsByPeriod);
}

function slotHintKey(mode: MoveMode): string {
  return mode === 'day'
    ? 'movedLesson.selectDayHint'
    : 'movedLesson.selectSlotHint';
}

function moveModeHintKey(mode: MoveMode): string {
  if (mode === 'room') {
    return 'movedLesson.roomMoveHint';
  }
  if (mode === 'day') {
    return 'movedLesson.dayMoveHint';
  }
  return 'movedLesson.manualMoveHint';
}

// The source slot of the edited move: the first lesson's day and room.
function resolveSourceSlot(item?: MovedLessonItem | null): {
  fromRoomId: string;
  sourceWeekdayId: string;
} {
  const firstLesson = item?.lessons[0];
  return {
    fromRoomId: firstLesson?.classrooms?.[0]?.id ?? '',
    sourceWeekdayId: firstLesson?.day?.id ?? '',
  };
}

// The source date is the lesson's date. For a room move the move's own date
// already lands on the source weekday; otherwise anchor on it and shift to the
// source weekday so the derived weekday stays correct. The shift stays within
// the SAME week as the target date (no wrap): a negative offset moves to the
// source weekday earlier in the week, a positive one later. This handles both
// source-before-target (Mon → Fri) and source-after-target (Fri → Mon) moves.
function resolveInitialSourceDate(
  item: MovedLessonItem | null | undefined,
  days: DayDefinition[],
  sourceWeekdayId: string
): Date {
  const anchor = item?.movedLesson.date
    ? new Date(item.movedLesson.date)
    : new Date();
  const weekdayIndex = sourceWeekdayId
    ? getWeekdayIndex(sourceWeekdayId, days)
    : anchor.getDay();
  const initialSourceDate = new Date(anchor);
  initialSourceDate.setDate(
    anchor.getDate() + (weekdayIndex - anchor.getDay())
  );
  return initialSourceDate;
}

// Add or remove one lesson id, keeping the selection de-duplicated.
function nextLessonIds(
  current: string[],
  lessonId: string,
  checked: boolean
): string[] {
  if (checked) {
    return Array.from(new Set([...current, lessonId]));
  }
  return current.filter((id) => id !== lessonId);
}

// Group selected lesson ids by their period, so a room move can create one
// moved-lesson entry per period. Every selected lesson must resolve to a
// period.
function groupLessonIdsByPeriod(
  lessonIds: string[],
  allLessons: EnrichedLesson[]
): Array<{ startingPeriod: string; lessonIds: string[] }> {
  const groups = new Map<string, string[]>();
  for (const id of lessonIds) {
    const periodId = allLessons.find((lesson) => lesson.id === id)?.period?.id;
    if (!periodId) {
      throw new Error('Every selected lesson must have a period');
    }
    groups.set(periodId, [...(groups.get(periodId) ?? []), id]);
  }
  return [...groups].map(([startingPeriod, ids]) => ({
    lessonIds: ids,
    startingPeriod,
  }));
}

// Whether the queried target slot is the edited move's original slot.
function isOriginalSlot(params: {
  dateParam: string;
  formStartingDay?: string | null;
  item?: MovedLessonItem | null;
  startingPeriod?: string | null;
}): boolean {
  const { item } = params;
  if (!item) {
    return false;
  }
  return (
    params.dateParam === item.movedLesson.date &&
    params.formStartingDay === item.movedLesson.startingDay &&
    params.startingPeriod === item.movedLesson.startingPeriod
  );
}

// A move is submittable once a target date, room, source day and at least one
// lesson are selected. Day moves additionally require a single target period;
// room moves may span several periods, so none is required.
function isMoveComplete(params: {
  date: unknown;
  lessonIds?: string[];
  mode: MoveMode;
  room?: string | null;
  startingDay?: string | null;
  startingPeriod?: string | null;
}): boolean {
  if (
    !(
      params.date &&
      params.room &&
      params.startingDay &&
      params.lessonIds?.length
    )
  ) {
    return false;
  }
  return params.mode === 'day' ? Boolean(params.startingPeriod) : true;
}

// A manual move is submittable once all seven source/target fields are set.
function isManualMoveComplete(params: {
  manualSourceCohort: string;
  manualSourceDate: Date | undefined;
  manualSourcePeriod: string;
  manualSourceRoom: string;
  manualTargetDate: Date | undefined;
  manualTargetPeriod: string;
  manualTargetRoom: string;
}): boolean {
  return Boolean(
    params.manualSourceDate &&
      params.manualSourcePeriod &&
      params.manualSourceCohort &&
      params.manualSourceRoom &&
      params.manualTargetDate &&
      params.manualTargetPeriod &&
      params.manualTargetRoom
  );
}

// A move is submittable when the mode-specific requirements are met: a manual
// move needs every manual field; a room-mode create additionally requires every
// selected lesson to resolve to a period.
function resolveIsValid(params: {
  allSelectedLessonsHavePeriod: boolean;
  date: unknown;
  isCreate: boolean;
  lessonIds?: string[];
  manualSourceCohort: string;
  manualSourceDate: Date | undefined;
  manualSourcePeriod: string;
  manualSourceRoom: string;
  manualTargetDate: Date | undefined;
  manualTargetPeriod: string;
  manualTargetRoom: string;
  mode: MoveMode;
  room?: string | null;
  startingDay?: string | null;
  startingPeriod?: string | null;
}): boolean {
  if (params.mode === 'manual') {
    return isManualMoveComplete(params);
  }
  if (!isMoveComplete(params)) {
    return false;
  }
  if (
    params.mode === 'room' &&
    params.isCreate &&
    !params.allSelectedLessonsHavePeriod
  ) {
    return false;
  }
  return true;
}

// Reset cross-mode form state when switching move modes. Entering manual mode
// clears lesson-based state; leaving it clears the manual fields.
function resetForMoveMode(next: MoveMode, form: MovedLessonFormApi): void {
  if (next === 'manual') {
    form.setFieldValue('lessonIds', []);
    form.setFieldValue('startingPeriod', undefined);
    return;
  }

  form.setFieldValue('manualSourceCohort', '');
  form.setFieldValue('manualSourceDate', undefined);
  form.setFieldValue('manualSourcePeriod', '');
  form.setFieldValue('manualSourceRoom', '');
  form.setFieldValue('manualSubject', '');
  form.setFieldValue('manualTargetDate', undefined);
  form.setFieldValue('manualTargetPeriod', '');
  form.setFieldValue('manualTargetRoom', '');
  form.setFieldValue('manualTeachers', []);

  form.setFieldValue('lessonIds', []);
  form.setFieldValue('startingPeriod', undefined);
  if (next === 'day') {
    form.setFieldValue('date', undefined);
    form.setFieldValue('startingDay', undefined);
  }
}

// Day moves and edits stay single-period; only room-mode creates may span
// several periods.
function shouldRestrictToSinglePeriod(
  mode: MoveMode,
  item: MovedLessonItem | null | undefined
): boolean {
  return mode === 'day' || Boolean(item);
}

// The lesson list has enough context to render: a day always, plus a from-room
// in room-move mode.
function hasLessonSlotContext(
  mode: MoveMode,
  sourceDay: string,
  fromRoom: string
): boolean {
  return mode === 'day' ? Boolean(sourceDay) : Boolean(sourceDay && fromRoom);
}

// Rooms offered as the move target, annotated with the queried slot's
// availability once that query has run.
function resolveRoomModeSlot(
  sourceDay: string,
  sourceDate: Date | undefined,
  current: { date: unknown; startingDay?: string | null }
): { date?: Date; startingDay?: string } {
  const synced: { date?: Date; startingDay?: string } = {};
  if (sourceDay && current.startingDay !== sourceDay) {
    synced.startingDay = sourceDay;
  }
  const currentDate = current.date;
  if (
    sourceDate &&
    (!(currentDate instanceof Date) ||
      currentDate.getTime() !== sourceDate.getTime())
  ) {
    synced.date = sourceDate;
  }
  return synced;
}

type RoomOption = {
  disabled: boolean;
  indicator?: ReactNode;
  label: string;
  occupied: boolean;
  value: string;
};

function buildRoomOptions(params: {
  availableClassrooms?: Classroom[];
  availabilityKnown: boolean;
  classrooms: Classroom[];
  isStoredSlot: boolean;
  item?: MovedLessonItem | null;
  labels: { free: string; occupied: string };
}): RoomOption[] {
  const { availabilityKnown, labels } = params;
  const freeRoomIds = new Set(
    (params.availableClassrooms ?? []).map((cr) => cr.id)
  );

  // Treat the stored room as free only when the queried slot is the edited
  // move's original target slot; otherwise let the availability response stand
  // so a room occupied in the new slot stays occupied.
  const storedRoom = params.item?.movedLesson.room;
  if (params.isStoredSlot && storedRoom) {
    freeRoomIds.add(storedRoom);
  }

  return params.classrooms.map((cr) => {
    const isFree = !availabilityKnown || freeRoomIds.has(cr.id);
    const label = availabilityKnown
      ? `${cr.name} (${cr.short}) — ${isFree ? labels.free : labels.occupied}`
      : `${cr.name} (${cr.short})`;
    const isOccupied = availabilityKnown && !isFree;
    return {
      disabled: false,
      indicator: isOccupied ? (
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
      ) : undefined,
      label,
      occupied: isOccupied,
      value: cr.id,
    };
  });
}

// Fetch the classrooms free for each requested period and intersect them, so a
// target room counts as free only when it is free in every period.
async function fetchAvailableClassrooms(
  date: string,
  startingDay: string,
  periodIds: string[]
): Promise<Classroom[]> {
  const results = await Promise.all(
    periodIds.map((periodId) =>
      unwrapResponse<Classroom[]>(
        api.timetable.classrooms.getAvailable.$get({
          query: { date, startingDay, startingPeriod: periodId },
        }) as never
      )
    )
  );
  const [first, ...rest] = results;
  if (!first) {
    return [];
  }
  const restSets = rest.map((list) => new Set(list.map((room) => room.id)));
  return first.filter((room) => restSets.every((set) => set.has(room.id)));
}

type MovedLessonFormValues = InferRequestType<
  typeof api.timetable.movedLessons.$post
>['json'] & {
  manualSourceCohort: string;
  manualSourceDate: Date | undefined;
  manualSourcePeriod: string;
  manualSourceRoom: string;
  manualSubject: string;
  manualTargetDate: Date | undefined;
  manualTargetPeriod: string;
  manualTargetRoom: string;
  manualTeachers: string[];
};

/**
 * The dialog's fully-typed form API. Derived from `useForm` itself because
 * TanStack's validator generics are invariant; this form instance is the DI
 * boundary between the dialog shell and its field-group components.
 */
type MovedLessonFormApi = ReturnType<
  typeof useForm<
    MovedLessonFormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    unknown
  >
>;

const initialState = (
  item?: MovedLessonItem | null
): MovedLessonFormValues => ({
  comment: item?.movedLesson.comment ?? null,
  date: item?.movedLesson.date ? new Date(item.movedLesson.date) : new Date(),
  lessonIds: item?.lessons.map((lesson) => lesson.id) ?? [],
  manualSourceCohort: '',
  manualSourceDate: undefined,
  manualSourcePeriod: '',
  manualSourceRoom: '',
  manualSubject: '',
  manualTargetDate: undefined,
  manualTargetPeriod: '',
  manualTargetRoom: '',
  manualTeachers: [],
  room: item?.movedLesson.room || undefined,
  startingDay: item?.movedLesson.startingDay || undefined,
  startingPeriod: item?.movedLesson.startingPeriod || undefined,
});

// Build the payload for a manual move from the manual-only form fields.
function buildManualCreatePayload(value: MovedLessonFormValues) {
  return {
    cohortId: value.manualSourceCohort,
    comment: value.comment ?? null,
    sourceDate: value.manualSourceDate as Date,
    sourcePeriodId: value.manualSourcePeriod,
    sourceRoomId: value.manualSourceRoom,
    subjectId: value.manualSubject || null,
    targetDate: value.manualTargetDate as Date,
    targetPeriodId: value.manualTargetPeriod,
    targetRoomId: value.manualTargetRoom,
    teacherIds: value.manualTeachers,
  };
}

// A room move may span several periods; a moved-lesson row carries a single
// startingPeriod, so produce one payload per selected period.
function buildRoomBatchPayloads(
  value: MovedLessonFormValues,
  allLessons: EnrichedLesson[]
) {
  const groups = groupLessonIdsByPeriod(value.lessonIds ?? [], allLessons);
  return groups.map(({ startingPeriod, lessonIds }) => ({
    comment: value.comment ?? null,
    date: value.date,
    lessonIds,
    room: value.room as string,
    startingDay: value.startingDay as string,
    startingPeriod,
  }));
}

type MoveModeToggleProps = {
  isCreate: boolean;
  mode: MoveMode;
  onChange: (mode: MoveMode) => void;
};

function MoveModeToggle({ isCreate, mode, onChange }: MoveModeToggleProps) {
  const { t } = useTranslation();

  if (!isCreate) {
    return null;
  }

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
        <Button
          onClick={() => onChange('manual')}
          size="sm"
          variant={mode === 'manual' ? 'default' : 'outline'}
        >
          {t('movedLesson.manualMove')}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {t(moveModeHintKey(mode))}
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

type LessonListProps = {
  formLessonIds?: string[];
  hasSlotContext: boolean;
  lessons: EnrichedLesson[];
  mode: MoveMode;
  onToggle: (lesson: EnrichedLesson, checked: boolean) => void;
  restrictToSinglePeriod: boolean;
  selectedPeriodId: string;
};

// Lessons of the selected source slot, with the same-period selection rule.
function LessonList({
  formLessonIds,
  hasSlotContext,
  lessons,
  mode,
  onToggle,
  restrictToSinglePeriod,
  selectedPeriodId,
}: LessonListProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t('movedLesson.lessons')}</Label>
      <div className="max-h-48 overflow-y-auto rounded-lg border">
        <div className="space-y-1 p-2">
          {!hasSlotContext && (
            <p className="p-2 text-muted-foreground text-sm">
              {t(slotHintKey(mode))}
            </p>
          )}
          {hasSlotContext && lessons.length === 0 && (
            <p className="p-2 text-muted-foreground text-sm">
              {t('movedLesson.noLessons')}
            </p>
          )}
          {lessons.map((lesson) => {
            const isChecked = (formLessonIds ?? []).includes(lesson.id);
            // Once a lesson is selected, only lessons in the same period may be
            // added to the move. Day moves and room-mode edits are single-
            // period; only a room-mode create may span several periods.
            const isPeriodMismatch =
              restrictToSinglePeriod &&
              (formLessonIds ?? []).length > 0 &&
              !isChecked &&
              lesson.period?.id !== selectedPeriodId;

            return (
              <label
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                htmlFor={`ml-lesson-${lesson.id}`}
                key={lesson.id}
              >
                <Checkbox
                  checked={isChecked}
                  disabled={isPeriodMismatch}
                  id={`ml-lesson-${lesson.id}`}
                  onCheckedChange={(checked) => onToggle(lesson, !!checked)}
                />
                <span
                  className={
                    isPeriodMismatch ? 'text-muted-foreground' : undefined
                  }
                >
                  {formatLessonLabel(lesson as unknown as LessonForLabel)}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type FromRoomFieldProps = {
  classrooms: Classroom[];
  onChange: (value: string) => void;
  value: string;
};

// Source-room picker, shown in room-move mode only.
function FromRoomField({ classrooms, onChange, value }: FromRoomFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t('movedLesson.fromRoom')}</Label>
      <Combobox
        emptyMessage={t('movedLesson.noRoomFound')}
        onValueChange={onChange}
        options={classrooms.map((c) => ({
          label: `${c.name} (${c.short})`,
          value: c.id,
        }))}
        placeholder={t('movedLesson.fromRoom')}
        searchPlaceholder={t('search')}
        value={value}
      />
    </div>
  );
}

type TargetDateFieldProps = {
  date: Date | undefined;
  locale: string;
  onChange: (date: Date | undefined) => void;
};

// Target-date picker, shown in day-move mode only.
function TargetDateField({ date, locale, onChange }: TargetDateFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t('movedLesson.targetDate')}</Label>
      <DatePicker
        date={date}
        locale={locale}
        onDateChange={onChange}
        placeholder={t('movedLesson.datePlaceholder')}
      />
    </div>
  );
}

type TargetRoomFieldProps = {
  isLoading: boolean;
  isOccupied: boolean;
  onChange: (value: string) => void;
  options: RoomOption[];
  value: string;
};

// Target-room picker, annotated with the queried slot's availability.
function TargetRoomField({
  isLoading,
  isOccupied,
  onChange,
  options,
  value,
}: TargetRoomFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Label>{t('movedLesson.toRoom')}</Label>
      <Combobox
        className={isLoading ? 'pointer-events-none opacity-50' : undefined}
        emptyMessage={
          isLoading
            ? t('movedLesson.loadingRooms')
            : t('movedLesson.noRoomFound')
        }
        onValueChange={onChange}
        options={options}
        placeholder={t('movedLesson.toRoom')}
        searchPlaceholder={t('search')}
        value={value}
      />
      {isOccupied && (
        <div className="flex items-center gap-2 rounded-md bg-warning/15 px-2 py-1.5 text-warning-foreground text-xs">
          <CircleAlert className="size-3.5 shrink-0" />
          {t('movedLesson.occupiedWarning')}
        </div>
      )}
    </div>
  );
}

type ManualMoveFieldsProps = {
  classrooms: Classroom[];
  cohorts: Cohort[];
  form: MovedLessonFormApi;
  locale: string;
  periods: Period[];
  subjects?: Subject[];
  teachers?: Teacher[];
};

// Manual move fields: the admin specifies the source and target entirely by
// hand instead of picking existing lessons.
function ManualMoveFields({
  classrooms,
  cohorts,
  form,
  locale,
  periods,
  subjects = [],
  teachers = [],
}: ManualMoveFieldsProps) {
  const { t } = useTranslation();
  const [teacherSearch, setTeacherSearch] = useState('');

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) {
      return teachers;
    }
    return teachers.filter((teacher) =>
      `${teacher.firstName} ${teacher.lastName} ${teacher.short}`
        .toLowerCase()
        .includes(query)
    );
  }, [teacherSearch, teachers]);

  return (
    <>
      <div className="space-y-2">
        <Label>{t('movedLesson.sourceDate')}</Label>
        <form.Field name="manualSourceDate">
          {(field) => (
            <DatePicker
              date={field.state.value}
              locale={locale}
              onDateChange={(date) => field.handleChange(date)}
              placeholder={t('movedLesson.datePlaceholder')}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.sourcePeriod')}</Label>
        <form.Field name="manualSourcePeriod">
          {(field) => (
            <Combobox
              emptyMessage={t('movedLesson.noPeriodsFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={periods.map((period) => ({
                label: formatPeriodLabel(period),
                value: period.id,
              }))}
              placeholder={t('movedLesson.sourcePeriodPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.class')}</Label>
        <form.Field name="manualSourceCohort">
          {(field) => (
            <Combobox
              emptyMessage={t('movedLesson.noCohortFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={cohorts.map((cohort) => ({
                label: `${cohort.name} (${cohort.short})`,
                value: cohort.id,
              }))}
              placeholder={t('movedLesson.selectCohortPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.sourceRoom')}</Label>
        <form.Field name="manualSourceRoom">
          {(field) => (
            <Combobox
              emptyMessage={t('movedLesson.noRoomFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={classrooms.map((c) => ({
                label: `${c.name} (${c.short})`,
                value: c.id,
              }))}
              placeholder={t('movedLesson.sourceRoomPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.subject')}</Label>
        <form.Field name="manualSubject">
          {(field) => (
            <Combobox
              emptyMessage={t('movedLesson.noSubjectsFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={subjects.map((subject) => ({
                label: `${subject.name} (${subject.short})`,
                value: subject.id,
              }))}
              placeholder={t('movedLesson.subjectPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.teacher')}</Label>
        <Input
          onChange={(e) => setTeacherSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          placeholder={t('search')}
          type="text"
          value={teacherSearch}
        />
        <form.Field name="manualTeachers">
          {(field) => (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {filteredTeachers.length === 0 && (
                <p className="p-2 text-muted-foreground text-sm">
                  {t('movedLesson.noTeachersFound')}
                </p>
              )}
              {filteredTeachers.map((teacher) => {
                const isChecked = field.state.value.includes(teacher.id);
                return (
                  <label
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    htmlFor={`ml-teacher-${teacher.id}`}
                    key={teacher.id}
                  >
                    <Checkbox
                      checked={isChecked}
                      id={`ml-teacher-${teacher.id}`}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? Array.from(
                              new Set([...field.state.value, teacher.id])
                            )
                          : field.state.value.filter((id) => id !== teacher.id);
                        field.handleChange(next);
                      }}
                    />
                    <span>
                      {`${teacher.firstName} ${teacher.lastName} (${teacher.short})`}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.targetDate')}</Label>
        <form.Field name="manualTargetDate">
          {(field) => (
            <DatePicker
              date={field.state.value}
              locale={locale}
              onDateChange={(date) => field.handleChange(date)}
              placeholder={t('movedLesson.datePlaceholder')}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.targetPeriod')}</Label>
        <form.Field name="manualTargetPeriod">
          {(field) => (
            <Combobox
              emptyMessage={t('movedLesson.noPeriodsFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={periods.map((period) => ({
                label: formatPeriodLabel(period),
                value: period.id,
              }))}
              placeholder={t('movedLesson.targetPeriodPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('movedLesson.targetRoom')}</Label>
        <form.Field name="manualTargetRoom">
          {(field) => (
            <Combobox
              emptyMessage={t('movedLesson.noRoomFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={classrooms.map((c) => ({
                label: `${c.name} (${c.short})`,
                value: c.id,
              }))}
              placeholder={t('movedLesson.toRoom')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
    </>
  );
}

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
  const { i18n, t } = useTranslation();
  const close = () => onOpenChange(false);
  const formId = useId();
  const commentId = useId();
  const createMutation = useCreateMovedLesson({ onSaved: close });
  const createBatchMutation = useCreateMovedLessonsBatch({ onSaved: close });
  const updateMutation = useUpdateMovedLesson({ onSaved: close });
  const manualMutation = useCreateManualMovedLesson({ onSaved: close });

  const [fromRoom, setFromRoom] = useState<string>('');
  const [sourceDate, setSourceDate] = useState<Date | undefined>();
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  const defaultValues = useMemo(() => initialState(item), [item]);

  // The source weekday id is derived from the source date.
  const sourceDay = useMemo(
    () => (sourceDate ? getWeekdayId(sourceDate, days) : ''),
    [sourceDate, days]
  );

  const form = useForm<
    MovedLessonFormValues,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    unknown
  >({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (mode === 'manual' && !item) {
        await manualMutation.mutateAsync(buildManualCreatePayload(value));
        return;
      }

      const {
        manualSourceCohort: _manualSourceCohort,
        manualSourceDate: _manualSourceDate,
        manualSourcePeriod: _manualSourcePeriod,
        manualSourceRoom: _manualSourceRoom,
        manualSubject: _manualSubject,
        manualTargetDate: _manualTargetDate,
        manualTargetPeriod: _manualTargetPeriod,
        manualTargetRoom: _manualTargetRoom,
        manualTeachers: _manualTeachers,
        ...payload
      } = value;

      if (item) {
        // Updates require every target field to be present.
        const hasAllFields =
          Boolean(payload.room) &&
          Boolean(payload.startingDay) &&
          Boolean(payload.startingPeriod);
        if (!hasAllFields) {
          throw new Error('All fields are required for updates');
        }
        await updateMutation.mutateAsync({
          id: item.movedLesson.id,
          payload: {
            comment: payload.comment ?? null,
            date: payload.date,
            lessonIds: payload.lessonIds ?? [],
            room: payload.room as string,
            startingDay: payload.startingDay as string,
            startingPeriod: payload.startingPeriod as string,
          },
        });
      } else if (mode === 'room') {
        await createBatchMutation.mutateAsync(
          buildRoomBatchPayloads(value, allLessons)
        );
      } else {
        await createMutation.mutateAsync(payload);
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
  const formManualSourceCohort = useStore(
    form.store,
    (state) => state.values.manualSourceCohort
  );
  const formManualSourceDate = useStore(
    form.store,
    (state) => state.values.manualSourceDate
  );
  const formManualSourcePeriod = useStore(
    form.store,
    (state) => state.values.manualSourcePeriod
  );
  const formManualSourceRoom = useStore(
    form.store,
    (state) => state.values.manualSourceRoom
  );
  const formManualTargetDate = useStore(
    form.store,
    (state) => state.values.manualTargetDate
  );
  const formManualTargetPeriod = useStore(
    form.store,
    (state) => state.values.manualTargetPeriod
  );
  const formManualTargetRoom = useStore(
    form.store,
    (state) => state.values.manualTargetRoom
  );

  const periodsQuery = useQuery({
    enabled: mode !== 'room',
    queryFn: async (): Promise<Period[]> => {
      const res = await parseResponse(
        api.timetable.periods.getAll.$get({ query: {} })
      );
      if (!res.success) {
        throw new Error('Failed to load periods');
      }
      return res.data as Period[];
    },
    queryKey: queryKeys.timetable.periods(null),
  });

  const subjectsQuery = useMovedLessonSubjects(mode === 'manual');
  const teachersQuery = useMovedLessonTeachers(mode === 'manual');

  // The selected lesson's current period (the slot it sits in).
  const selectedPeriodId = useMemo(() => {
    const firstId = (formLessonIds ?? [])[0];
    if (!firstId) {
      return '';
    }
    return allLessons.find((lesson) => lesson.id === firstId)?.period?.id ?? '';
  }, [allLessons, formLessonIds]);

  // Distinct periods of the currently selected lessons (room mode can span
  // several).
  const selectedPeriodIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of formLessonIds ?? []) {
      const periodId = allLessons.find((lesson) => lesson.id === id)?.period
        ?.id;
      if (periodId) {
        ids.add(periodId);
      }
    }
    return [...ids];
  }, [allLessons, formLessonIds]);

  // A room-mode create groups lessons by period, so every selected lesson must
  // resolve to a period before the move can be submitted.
  const allSelectedLessonsHavePeriod = useMemo(
    () =>
      (formLessonIds ?? []).every((id) =>
        allLessons.some((lesson) => lesson.id === id && lesson.period?.id)
      ),
    [allLessons, formLessonIds]
  );

  // Reset the form and derive the source slot whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(defaultValues);

    const { fromRoomId, sourceWeekdayId } = resolveSourceSlot(item);

    setFromRoom(fromRoomId);
    setSelectedCohort('');

    setSourceDate(resolveInitialSourceDate(item, days, sourceWeekdayId));
  }, [days, defaultValues, form, item, open]);

  // In room-move mode the target slot is the source slot.
  useEffect(() => {
    if (mode !== 'room') {
      return;
    }
    const synced = resolveRoomModeSlot(sourceDay, sourceDate, {
      date: form.getFieldValue('date'),
      startingDay: form.getFieldValue('startingDay'),
    });
    if (synced.startingDay !== undefined) {
      form.setFieldValue('startingDay', synced.startingDay);
    }
    if (synced.date !== undefined) {
      form.setFieldValue('date', synced.date);
    }
  }, [form, mode, sourceDate, sourceDay]);

  // Keep the target period in sync with the selected lesson's period. A
  // room-mode edit is single-period, so track the (single) selected lesson;
  // day mode defaults to the selected lesson's period when none is picked. A
  // room-mode create may span several periods, so no single period is forced.
  useEffect(() => {
    if (mode === 'room') {
      if (
        item &&
        selectedPeriodId &&
        form.getFieldValue('startingPeriod') !== selectedPeriodId
      ) {
        form.setFieldValue('startingPeriod', selectedPeriodId);
      }
      return;
    }
    if (!selectedPeriodId) {
      return;
    }
    if (!form.getFieldValue('startingPeriod')) {
      form.setFieldValue('startingPeriod', selectedPeriodId);
    }
  }, [form, item, mode, selectedPeriodId]);

  // Normalised target date string, shared by the availability query and the
  // stored-slot comparison so both always refer to the same queried slot.
  const dateParam = useMemo(
    () =>
      formDate instanceof Date
        ? formDate.toISOString().slice(0, 10)
        : String(formDate ?? ''),
    [formDate]
  );

  // Whether the queried target slot is the edited move's original slot.
  const isStoredSlot = useMemo(
    () =>
      isOriginalSlot({
        dateParam,
        formStartingDay,
        item,
        startingPeriod: formStartingPeriod,
      }),
    [dateParam, formStartingDay, formStartingPeriod, item]
  );

  // Periods to check availability for: every selected period in room mode, or
  // the single target period in day mode.
  const availabilityPeriodIds = useMemo(() => {
    if (mode === 'room') {
      return selectedPeriodIds;
    }
    return formStartingPeriod ? [formStartingPeriod] : [];
  }, [mode, selectedPeriodIds, formStartingPeriod]);

  const availabilityPeriodKey = useMemo(
    () =>
      mode === 'room'
        ? selectedPeriodIds.join(',')
        : (formStartingPeriod ?? ''),
    [mode, selectedPeriodIds, formStartingPeriod]
  );

  const availabilityKnown = Boolean(
    formDate && formStartingDay && availabilityPeriodIds.length
  );

  const availableClassroomsQuery = useQuery<Classroom[]>({
    enabled: availabilityKnown,
    queryFn: () =>
      fetchAvailableClassrooms(
        dateParam,
        formStartingDay as string,
        availabilityPeriodIds
      ),
    queryKey: queryKeys.timetable.availableClassrooms(
      formDate,
      formStartingDay,
      availabilityPeriodKey
    ),
  });

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

  const roomOptions = useMemo(
    () =>
      buildRoomOptions({
        availabilityKnown,
        availableClassrooms: availableClassroomsQuery.data,
        classrooms,
        isStoredSlot,
        item,
        labels: {
          free: t('movedLesson.free'),
          occupied: t('movedLesson.occupied'),
        },
      }),
    [
      availableClassroomsQuery.data,
      availabilityKnown,
      classrooms,
      isStoredSlot,
      item,
      t,
    ]
  );

  const isCreate = !item;

  const selectedRoomOccupied = useMemo(
    () =>
      roomOptions.find((option) => option.value === formRoom)?.occupied ??
      false,
    [roomOptions, formRoom]
  );

  const isValid = useMemo(
    () =>
      resolveIsValid({
        allSelectedLessonsHavePeriod,
        date: formDate,
        isCreate,
        lessonIds: formLessonIds,
        manualSourceCohort: formManualSourceCohort,
        manualSourceDate: formManualSourceDate,
        manualSourcePeriod: formManualSourcePeriod,
        manualSourceRoom: formManualSourceRoom,
        manualTargetDate: formManualTargetDate,
        manualTargetPeriod: formManualTargetPeriod,
        manualTargetRoom: formManualTargetRoom,
        mode,
        room: formRoom,
        startingDay: formStartingDay,
        startingPeriod: formStartingPeriod,
      }),
    [
      allSelectedLessonsHavePeriod,
      formDate,
      formLessonIds,
      formManualSourceCohort,
      formManualSourceDate,
      formManualSourcePeriod,
      formManualSourceRoom,
      formManualTargetDate,
      formManualTargetPeriod,
      formManualTargetRoom,
      formRoom,
      formStartingDay,
      formStartingPeriod,
      isCreate,
      mode,
    ]
  );

  // Whether the lessons list has enough context to render: a day always, plus
  // a from-room in room-move mode.
  const hasSlotContext = hasLessonSlotContext(mode, sourceDay, fromRoom);

  const toggleLesson = (lesson: EnrichedLesson, checked: boolean) => {
    const current = form.getFieldValue('lessonIds') ?? [];
    form.setFieldValue('lessonIds', nextLessonIds(current, lesson.id, checked));
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

  const handleTargetRoomChange = (value: string) => {
    form.setFieldValue('room', value || undefined);
  };

  const handleModeChange = (next: MoveMode) => {
    if (next === mode) {
      return;
    }
    onModeChange?.(next);

    setFromRoom('');
    if (next === 'manual') {
      setSelectedCohort('');
    }

    resetForMoveMode(next, form);
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

          <MoveModeToggle
            isCreate={isCreate}
            mode={mode}
            onChange={handleModeChange}
          />

          <form
            className="mt-4 space-y-4"
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            {mode === 'manual' ? (
              <ManualMoveFields
                classrooms={classrooms}
                cohorts={cohorts}
                form={form}
                locale={getIntlLocale(i18n.language)}
                periods={periodsQuery.data ?? []}
                subjects={subjectsQuery.data}
                teachers={teachersQuery.data}
              />
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t('movedLesson.date')}</Label>
                  <DatePicker
                    date={sourceDate}
                    locale={getIntlLocale(i18n.language)}
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
                  <FromRoomField
                    classrooms={classrooms}
                    onChange={handleFromRoomChange}
                    value={fromRoom}
                  />
                )}

                <LessonList
                  formLessonIds={formLessonIds}
                  hasSlotContext={hasSlotContext}
                  lessons={visibleLessons}
                  mode={mode}
                  onToggle={toggleLesson}
                  restrictToSinglePeriod={shouldRestrictToSinglePeriod(
                    mode,
                    item
                  )}
                  selectedPeriodId={selectedPeriodId}
                />

                {mode === 'day' && (
                  <TargetDateField
                    date={formDate instanceof Date ? formDate : undefined}
                    locale={getIntlLocale(i18n.language)}
                    onChange={handleTargetDateChange}
                  />
                )}

                {mode === 'day' && (
                  <div className="space-y-2">
                    <Label>{t('movedLesson.targetPeriod')}</Label>
                    <Combobox
                      emptyMessage={t('movedLesson.noPeriodsFound')}
                      onValueChange={(value) => {
                        const startingPeriod = value || undefined;
                        if (
                          startingPeriod !==
                          form.getFieldValue('startingPeriod')
                        ) {
                          form.setFieldValue('room', undefined);
                        }
                        form.setFieldValue('startingPeriod', startingPeriod);
                      }}
                      options={(periodsQuery.data ?? []).map((period) => ({
                        label: formatPeriodLabel(period),
                        value: period.id,
                      }))}
                      placeholder={t('movedLesson.targetPeriodPlaceholder')}
                      searchPlaceholder={t('search')}
                      value={formStartingPeriod ?? ''}
                    />
                  </div>
                )}

                <TargetRoomField
                  isLoading={availableClassroomsQuery.isLoading}
                  isOccupied={selectedRoomOccupied}
                  onChange={handleTargetRoomChange}
                  options={roomOptions}
                  value={formRoom ?? ''}
                />
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor={commentId}>{t('movedLesson.comment')}</Label>
              <form.Field name="comment">
                {(field) => (
                  <Textarea
                    id={commentId}
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
            disabled={
              !isValid || form.state.isSubmitting || manualMutation.isPending
            }
            form={formId}
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
