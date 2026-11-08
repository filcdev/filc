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
import { Label } from '@filcdev/ui/components/label';
import { Textarea } from '@filcdev/ui/components/textarea';
import { type AnyFormApi, useForm, useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightLeft, Save } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClassroomItem,
  PeriodItem,
  TeacherItem,
} from '@/components/timetable/types';
import {
  type Cohort,
  type DayDefinition,
  type EnrichedLesson,
  type MovedLessonItem,
  useCreateMovedLesson,
  useUpdateMovedLesson,
} from '@/hooks/moved-lessons';
import { getIntlLocale, isMatchingWeekday } from '@/utils/date-locale';
import { type api, orpc } from '@/utils/orpc';
import { formatPeriodLabel } from '@/utils/period';
import type { BaseDialogProps } from './admin.types';

export type MoveMode = 'room' | 'day';

// What a moved lesson is built from: existing timetable lessons, or a
// one-off manual entry (a subject plus classes) with no source lessons.
export type SourceMode = 'timetable' | 'manual';

type MovedLessonDialogProps = BaseDialogProps & {
  allLessons: EnrichedLesson[];
  classrooms: ClassroomItem[];
  cohorts: Cohort[];
  days: DayDefinition[];
  item?: MovedLessonItem | null;
  mode?: MoveMode;
  onModeChange?: (mode: MoveMode) => void;
};

// A cohort as every lesson endpoint now reports it: one shape, so this is
// only a structural minimum for the formatters below.
type CohortRef = { id: string; name: string; short?: string };

type LessonForLabel = {
  id: string;
  classrooms?: Array<{ name?: string; short?: string }>;
  cohorts?: CohortRef[];
  period?: {
    startTime?: string | null;
    endTime?: string | null;
    period?: number | null;
  } | null;
  subject?: { name?: string; short?: string } | null;
  teachers?: Array<{ name?: string; short?: string }>;
};

function formatLessonLabel(lesson: LessonForLabel, periodWord: string): string {
  const parts: string[] = [];

  if (lesson.period?.startTime && lesson.period?.endTime) {
    parts.push(formatPeriodLabel(lesson.period, periodWord));
  }

  if (lesson.subject?.short) {
    parts.push(lesson.subject.short);
  }

  if (lesson.cohorts && lesson.cohorts.length > 0) {
    // `short` first, matching formatCohort in components/timetable/helpers.
    const cohortLabels = lesson.cohorts.map((c) => c.short ?? c.name ?? '');
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

/** Sortable class label for a lesson. */
function cohortLabel(cohorts: CohortRef[] | undefined): string {
  if (!cohorts?.length) {
    return '';
  }
  return cohorts.map((cohort) => cohort.short ?? cohort.name ?? '').join(', ');
}

/** `Firstname Lastname (short)` for the teacher checkbox list. */
function formatTeacherLabel(teacher: TeacherItem): string {
  return `${teacher.firstName} ${teacher.lastName} (${teacher.short})`;
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
  return cohortLabel(a.cohorts).localeCompare(cohortLabel(b.cohorts));
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
    const matchesCohort =
      mode !== 'day' ||
      !cohortName ||
      lesson.cohorts?.some((cohort) => cohort.name === cohortName);
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
    params.dateParam === item.movedLesson.date.toISOString().slice(0, 10) &&
    params.formStartingDay === item.movedLesson.startingDay &&
    params.startingPeriod === item.movedLesson.startingPeriod
  );
}

// A move is submittable once a target date, room, source day, period and at
// least one lesson are selected; a manual move needs a subject and ≥1 class
// instead of lessons.
function isMoveComplete(params: {
  date: unknown;
  lessonIds?: string[];
  manualCohortIds?: string[];
  manualSubjectId?: string;
  room?: string | null;
  source: SourceMode;
  startingDay?: string | null;
  startingPeriod?: string | null;
}): boolean {
  const hasTarget =
    Boolean(params.date) &&
    Boolean(params.room) &&
    Boolean(params.startingDay) &&
    Boolean(params.startingPeriod);
  if (!hasTarget) {
    return false;
  }
  return params.source === 'manual'
    ? Boolean(params.manualSubjectId && params.manualCohortIds?.length)
    : Boolean(params.lessonIds?.length);
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

type RoomOption = { disabled: boolean; label: string; value: string };

function buildRoomOptions(params: {
  availableClassrooms?: ClassroomItem[];
  availabilityKnown: boolean;
  classrooms: ClassroomItem[];
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
    return {
      disabled: availabilityKnown && !freeRoomIds.has(cr.id),
      label,
      value: cr.id,
    };
  });
}

type MovedLessonFormValues = Parameters<
  typeof api.timetable.movedLessons.create
>[0];

const initialState = (
  item?: MovedLessonItem | null
): MovedLessonFormValues => ({
  comment: item?.movedLesson.comment ?? null,
  date: item?.movedLesson.date ? new Date(item.movedLesson.date) : new Date(),
  lessonIds: item?.lessons.map((lesson) => lesson.id) ?? [],
  // Use the resolved refs, not the raw arrays: a deleted cohort/teacher is
  // filtered out there, and re-submitting its stale id would fail validation.
  manualCohortIds: item?.manual?.cohorts.map(({ id }) => id) ?? [],
  manualSourceRoomId: item?.manual?.sourceRoom?.id ?? undefined,
  manualSubjectId: item?.manual?.subject?.id ?? undefined,
  manualTeacherIds: item?.manual?.teachers.map(({ id }) => id) ?? [],
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

type SourceToggleProps = {
  disabled?: boolean;
  onChange: (source: SourceMode) => void;
  source: SourceMode;
};

// Timetable-linked vs manual (one-off) source. Disabled while editing: an
// existing move's source is fixed so it can never be converted by accident.
function SourceToggle({ disabled, onChange, source }: SourceToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
      <p className="font-medium text-sm">{t('movedLesson.source')}</p>
      <div className="flex gap-2">
        <Button
          disabled={disabled}
          onClick={() => onChange('timetable')}
          size="sm"
          variant={source === 'timetable' ? 'default' : 'outline'}
        >
          {t('movedLesson.sourceTimetable')}
        </Button>
        <Button
          disabled={disabled}
          onClick={() => onChange('manual')}
          size="sm"
          variant={source === 'manual' ? 'default' : 'outline'}
        >
          {t('movedLesson.sourceManual')}
        </Button>
      </div>
      {source === 'manual' && (
        <p className="text-muted-foreground text-xs">
          {t('movedLesson.manualHint')}
        </p>
      )}
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

// A scrollable, bordered checkbox list in the same visual style as `LessonList`.
function CheckboxList<T extends { id: string }>({
  emptyMessage,
  htmlFor,
  items,
  label,
  onChange,
  selectedIds,
  format,
}: {
  emptyMessage: string;
  format: (item: T) => string;
  htmlFor: (id: string) => string;
  items: T[];
  label: string;
  onChange: (id: string, checked: boolean) => void;
  selectedIds: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-48 overflow-y-auto rounded-lg border">
        <div className="space-y-1 p-2">
          {items.length === 0 && (
            <p className="p-2 text-muted-foreground text-sm">{emptyMessage}</p>
          )}
          {items.map((item) => {
            const checked = selectedIds.includes(item.id);
            return (
              <label
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                htmlFor={htmlFor(item.id)}
                key={item.id}
              >
                <Checkbox
                  checked={checked}
                  id={htmlFor(item.id)}
                  onCheckedChange={(value) => onChange(item.id, !!value)}
                />
                <span>{format(item)}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ManualSourceSectionProps = {
  classrooms: ClassroomItem[];
  cohorts: Cohort[];
  form: AnyFormApi;
};

// The manual source: a subject, teachers, classes and (optionally) the room it
// comes from. Replaces every timetable source field (date/cohort/from-room/
// lesson list) when the source is manual. Self-contained so it owns its lookups
// and handlers; it only ever mounts in manual mode, so the subject/teacher
// queries can run unconditionally.
function ManualSourceSection({
  classrooms,
  cohorts,
  form,
}: ManualSourceSectionProps) {
  const { t } = useTranslation();
  const formManualCohortIds = useStore(
    form.store,
    (state) => state.values.manualCohortIds
  );
  const formManualSourceRoomId = useStore(
    form.store,
    (state) => state.values.manualSourceRoomId
  );
  const formManualSubjectId = useStore(
    form.store,
    (state) => state.values.manualSubjectId
  );
  const formManualTeacherIds = useStore(
    form.store,
    (state) => state.values.manualTeacherIds
  );

  const subjectsQuery = useQuery({
    ...orpc.timetable.subjects.queryOptions(),
  });
  const teachersQuery = useQuery({
    ...orpc.timetable.teachers.getAll.queryOptions(),
  });

  const handleSubjectChange = (value: string) => {
    form.setFieldValue('manualSubjectId', value || undefined);
  };

  const handleSourceRoomChange = (value: string) => {
    form.setFieldValue('manualSourceRoomId', value || undefined);
  };

  const handleTeacherToggle = (id: string, checked: boolean) => {
    const current = form.getFieldValue('manualTeacherIds') ?? [];
    form.setFieldValue('manualTeacherIds', nextLessonIds(current, id, checked));
  };

  const handleCohortToggle = (id: string, checked: boolean) => {
    const current = form.getFieldValue('manualCohortIds') ?? [];
    form.setFieldValue('manualCohortIds', nextLessonIds(current, id, checked));
  };

  const needsClass = (formManualCohortIds ?? []).length === 0;

  return (
    <>
      <div className="space-y-2">
        <Label>{t('movedLesson.subject')}</Label>
        <Combobox
          emptyMessage={t('movedLesson.noSubjectFound')}
          onValueChange={handleSubjectChange}
          options={(subjectsQuery.data?.items ?? []).map((subject) => ({
            label: `${subject.name} (${subject.short})`,
            value: subject.id,
          }))}
          placeholder={t('movedLesson.selectSubjectPlaceholder')}
          searchPlaceholder={t('search')}
          value={formManualSubjectId ?? ''}
        />
      </div>

      <CheckboxList
        emptyMessage={t('movedLesson.noTeacherFound')}
        format={formatTeacherLabel}
        htmlFor={(id) => `ml-teacher-${id}`}
        items={teachersQuery.data?.items ?? []}
        label={t('movedLesson.teachers')}
        onChange={handleTeacherToggle}
        selectedIds={formManualTeacherIds ?? []}
      />

      <CheckboxList
        emptyMessage={t('movedLesson.noClassFound')}
        format={(cohort) => `${cohort.name} (${cohort.short})`}
        htmlFor={(id) => `ml-cohort-${id}`}
        items={cohorts}
        label={t('movedLesson.classes')}
        onChange={handleCohortToggle}
        selectedIds={formManualCohortIds ?? []}
      />

      <FromRoomField
        classrooms={classrooms}
        onChange={handleSourceRoomChange}
        value={formManualSourceRoomId ?? ''}
      />

      {(!formManualSubjectId || needsClass) && (
        <p className="text-muted-foreground text-xs">
          {t('movedLesson.manualRequired')}
        </p>
      )}
    </>
  );
}

type LessonListProps = {
  formLessonIds?: string[];
  hasSlotContext: boolean;
  lessons: EnrichedLesson[];
  mode: MoveMode;
  onToggle: (lesson: EnrichedLesson, checked: boolean) => void;
  selectedPeriodId: string;
};

// Lessons of the selected source slot, with the same-period selection rule.
function LessonList({
  formLessonIds,
  hasSlotContext,
  lessons,
  mode,
  onToggle,
  selectedPeriodId,
}: LessonListProps) {
  const { t } = useTranslation();
  const selectedLessonIds = new Set(formLessonIds ?? []);

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
            const isChecked = selectedLessonIds.has(lesson.id);
            // Once a lesson is selected, only lessons in the same
            // period may be added to the move.
            const isPeriodMismatch =
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
                  {formatLessonLabel(
                    lesson as unknown as LessonForLabel,
                    t('substitution.period')
                  )}
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
  classrooms: ClassroomItem[];
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
  checkAvailability: boolean;
  classrooms: ClassroomItem[];
  isLoading: boolean;
  onChange: (value: string) => void;
  options: RoomOption[];
  value: string;
};

// Target-room picker. In timetable mode the options carry the queried slot's
// availability (occupied rooms disabled); in manual mode every classroom is
// offered as-is so the admin can pick any room.
function TargetRoomField({
  checkAvailability,
  classrooms,
  isLoading,
  onChange,
  options,
  value,
}: TargetRoomFieldProps) {
  const { t } = useTranslation();
  const roomOptions: RoomOption[] = checkAvailability
    ? options
    : classrooms.map((c) => ({
        disabled: false,
        label: `${c.name} (${c.short})`,
        value: c.id,
      }));
  const showLoading = checkAvailability && isLoading;

  return (
    <div className="space-y-2">
      <Label>{t('movedLesson.toRoom')}</Label>
      <Combobox
        className={showLoading ? 'pointer-events-none opacity-50' : undefined}
        emptyMessage={
          showLoading
            ? t('movedLesson.loadingRooms')
            : t('movedLesson.noRoomFound')
        }
        onValueChange={onChange}
        options={roomOptions}
        placeholder={t('movedLesson.toRoom')}
        searchPlaceholder={t('search')}
        value={value}
      />
    </div>
  );
}

type MovedLessonSourceFieldsProps = {
  classrooms: ClassroomItem[];
  cohorts: Cohort[];
  formLessonIds?: string[];
  fromRoom: string;
  hasSlotContext: boolean;
  lessons: EnrichedLesson[];
  mode: MoveMode;
  onCohortChange: (value: string) => void;
  onFromRoomChange: (value: string) => void;
  onSourceDateChange: (date: Date | undefined) => void;
  onToggleLesson: (lesson: EnrichedLesson, checked: boolean) => void;
  selectedCohort: string;
  selectedPeriodId: string;
  sourceDate: Date | undefined;
};

// Everything that selects *what* moves: the source date, the room (or cohort)
// it sits in, and the lessons themselves.
function MovedLessonSourceFields({
  classrooms,
  cohorts,
  formLessonIds,
  fromRoom,
  hasSlotContext,
  lessons,
  mode,
  onCohortChange,
  onFromRoomChange,
  onSourceDateChange,
  onToggleLesson,
  selectedCohort,
  selectedPeriodId,
  sourceDate,
}: MovedLessonSourceFieldsProps) {
  const { i18n, t } = useTranslation();

  return (
    <>
      <div className="space-y-2">
        <Label>{t('movedLesson.date')}</Label>
        <DatePicker
          date={sourceDate}
          locale={getIntlLocale(i18n.language)}
          onDateChange={onSourceDateChange}
          placeholder={t('movedLesson.datePlaceholder')}
        />
      </div>

      {mode === 'day' && (
        <CohortSelector
          cohorts={cohorts}
          onChange={onCohortChange}
          value={selectedCohort}
        />
      )}

      {mode === 'room' && (
        <FromRoomField
          classrooms={classrooms}
          onChange={onFromRoomChange}
          value={fromRoom}
        />
      )}

      <LessonList
        formLessonIds={formLessonIds}
        hasSlotContext={hasSlotContext}
        lessons={lessons}
        mode={mode}
        onToggle={onToggleLesson}
        selectedPeriodId={selectedPeriodId}
      />
    </>
  );
}

type MovedLessonTargetFieldsProps = {
  checkAvailability: boolean;
  classrooms: ClassroomItem[];
  isLoadingRooms: boolean;
  mode: MoveMode;
  onPeriodChange: (value: string) => void;
  onTargetDateChange: (date: Date | undefined) => void;
  onTargetRoomChange: (value: string) => void;
  periods: PeriodItem[];
  roomOptions: RoomOption[];
  startingPeriod: string;
  targetDate: Date | undefined;
  targetRoom: string;
};

// Everything that selects *where* the lessons move to: the target date, period
// and room.
function MovedLessonTargetFields({
  checkAvailability,
  classrooms,
  isLoadingRooms,
  mode,
  onPeriodChange,
  onTargetDateChange,
  onTargetRoomChange,
  periods,
  roomOptions,
  startingPeriod,
  targetDate,
  targetRoom,
}: MovedLessonTargetFieldsProps) {
  const { i18n, t } = useTranslation();

  if (mode !== 'day') {
    return (
      <TargetRoomField
        checkAvailability={checkAvailability}
        classrooms={classrooms}
        isLoading={isLoadingRooms}
        onChange={onTargetRoomChange}
        options={roomOptions}
        value={targetRoom}
      />
    );
  }

  return (
    <>
      <TargetDateField
        date={targetDate}
        locale={getIntlLocale(i18n.language)}
        onChange={onTargetDateChange}
      />

      <div className="space-y-2">
        <Label>{t('movedLesson.targetPeriod')}</Label>
        <Combobox
          emptyMessage={t('movedLesson.noPeriodsFound')}
          onValueChange={onPeriodChange}
          options={periods.map((period) => ({
            label: formatPeriodLabel(period, t('substitution.period')),
            value: period.id,
          }))}
          placeholder={t('movedLesson.targetPeriodPlaceholder')}
          searchPlaceholder={t('search')}
          value={startingPeriod}
        />
      </div>

      <TargetRoomField
        checkAvailability={checkAvailability}
        classrooms={classrooms}
        isLoading={isLoadingRooms}
        onChange={onTargetRoomChange}
        options={roomOptions}
        value={targetRoom}
      />
    </>
  );
}

type MovedLessonTargetSlotOptions = {
  classrooms: ClassroomItem[];
  form: AnyFormApi;
  item?: MovedLessonItem | null;
  labels: { free: string; occupied: string };
  source: SourceMode;
};

/**
 * The target-slot state the dialog derives from the form: the queried slot,
 * whether it is the edited move's own slot, the room options with their
 * availability, and whether the move is complete.
 */
function useMovedLessonTargetSlot({
  classrooms,
  form,
  item,
  labels,
  source,
}: MovedLessonTargetSlotOptions) {
  const formDate = useStore(form.store, (state) => state.values.date);
  const formLessonIds = useStore(form.store, (state) => state.values.lessonIds);
  const formManualCohortIds = useStore(
    form.store,
    (state) => state.values.manualCohortIds
  );
  const formManualSubjectId = useStore(
    form.store,
    (state) => state.values.manualSubjectId
  );
  const formStartingDay = useStore(
    form.store,
    (state) => state.values.startingDay
  );
  const formStartingPeriod = useStore(
    form.store,
    (state) => state.values.startingPeriod
  );
  const formRoom = useStore(form.store, (state) => state.values.room);

  // Normalised target date string, shared by the availability query and the
  // stored-slot comparison so both always refer to the same queried slot.
  const dateParam =
    formDate instanceof Date
      ? formDate.toISOString().slice(0, 10)
      : String(formDate ?? '');

  // Whether the queried target slot is the edited move's original slot.
  const isStoredSlot = isOriginalSlot({
    dateParam,
    formStartingDay,
    item,
    startingPeriod: formStartingPeriod,
  });

  const availableClassroomsQuery = useQuery({
    ...orpc.timetable.classrooms.getAvailable.queryOptions({
      input: {
        date: dateParam,
        startingDay: formStartingDay ?? '',
        startingPeriod: formStartingPeriod ?? '',
      },
    }),
    enabled:
      source === 'timetable' &&
      !!formDate &&
      !!formStartingDay &&
      !!formStartingPeriod,
  });

  const availabilityKnown = Boolean(
    formDate && formStartingDay && formStartingPeriod
  );

  const roomOptions = useMemo(
    () =>
      buildRoomOptions({
        availabilityKnown,
        availableClassrooms: availableClassroomsQuery.data?.items,
        classrooms,
        isStoredSlot,
        item,
        labels,
      }),
    [
      availableClassroomsQuery.data?.items,
      availabilityKnown,
      classrooms,
      isStoredSlot,
      item,
      labels,
    ]
  );

  const isValid = isMoveComplete({
    date: formDate,
    lessonIds: formLessonIds,
    manualCohortIds: formManualCohortIds,
    manualSubjectId: formManualSubjectId,
    room: formRoom,
    source,
    startingDay: formStartingDay,
    startingPeriod: formStartingPeriod,
  });

  return {
    availableClassroomsQuery,
    formDate,
    formLessonIds,
    formRoom,
    formStartingDay,
    formStartingPeriod,
    isValid,
    roomOptions,
  };
}

// Build and send the create/update payload. Exactly one source is sent: manual
// moves carry the subject + class/teacher ids, timetable moves the linked
// lesson ids; the other source stays omitted.
async function submitMovedLesson(
  value: MovedLessonFormValues,
  params: {
    createMutation: ReturnType<typeof useCreateMovedLesson>;
    isManual: boolean;
    item?: MovedLessonItem | null;
    updateMutation: ReturnType<typeof useUpdateMovedLesson>;
  }
): Promise<void> {
  const { createMutation, isManual, item, updateMutation } = params;
  const sourceFields = isManual
    ? {
        manualCohortIds: value.manualCohortIds ?? [],
        manualSourceRoomId: value.manualSourceRoomId,
        manualSubjectId: value.manualSubjectId,
        manualTeacherIds: value.manualTeacherIds ?? [],
      }
    : { lessonIds: value.lessonIds ?? [] };

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
      comment: value.comment ?? null,
      date: value.date,
      id: item.movedLesson.id,
      ...sourceFields,
      // An omitted source room means "leave it" on update; null clears it.
      ...(isManual
        ? { manualSourceRoomId: value.manualSourceRoomId ?? null }
        : {}),
      room: value.room as string,
      startingDay: value.startingDay as string,
      startingPeriod: value.startingPeriod as string,
    });
  } else {
    await createMutation.mutateAsync({
      comment: value.comment ?? null,
      date: value.date,
      ...sourceFields,
      room: value.room,
      startingDay: value.startingDay,
      startingPeriod: value.startingPeriod,
    });
  }
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
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const formId = useId();
  const commentId = useId();
  const createMutation = useCreateMovedLesson({ onSaved: close });
  const updateMutation = useUpdateMovedLesson({ onSaved: close });

  // Re-seeded on mount; the parent remounts this dialog per open/item via `key`.
  const initialSource = resolveSourceSlot(item);
  const [fromRoom, setFromRoom] = useState<string>(initialSource.fromRoomId);
  const [sourceDate, setSourceDate] = useState<Date | undefined>(() =>
    resolveInitialSourceDate(item, days, initialSource.sourceWeekdayId)
  );
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  // The move's source. On edit it is fixed by the resolved manual fields; a
  // new move starts from the timetable. The subject may be null after an
  // ON DELETE SET NULL, so the API's `manual` object is the signal. Local
  // state is fine because the parent remounts this dialog per open/item.
  const [source, setSource] = useState<SourceMode>(
    item?.manual ? 'manual' : 'timetable'
  );
  const isManual = source === 'manual';

  const defaultValues = useMemo(() => initialState(item), [item]);

  // The source weekday id is derived from the source date.
  const sourceDay = useMemo(
    () => (sourceDate ? getWeekdayId(sourceDate, days) : ''),
    [sourceDate, days]
  );

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await submitMovedLesson(value, {
        createMutation,
        isManual,
        item,
        updateMutation,
      });
    },
  });

  const isCreate = !item;

  const {
    availableClassroomsQuery,
    formDate,
    formLessonIds,
    formRoom,
    formStartingPeriod,
    isValid,
    roomOptions,
  } = useMovedLessonTargetSlot({
    classrooms,
    form,
    item,
    labels: {
      free: t('movedLesson.free'),
      occupied: t('movedLesson.occupied'),
    },
    source,
  });

  const periodsQuery = useQuery({
    ...orpc.timetable.periods.getAll.queryOptions({ input: {} }),
    enabled: mode === 'day' || isManual,
    select: (data): PeriodItem[] => data.items,
  });

  // The selected lesson's current period (the slot it sits in).
  const selectedPeriodId = useMemo(() => {
    const firstId = (formLessonIds ?? [])[0];
    if (!firstId) {
      return '';
    }
    return allLessons.find((lesson) => lesson.id === firstId)?.period?.id ?? '';
  }, [allLessons, formLessonIds]);

  // In room-move mode the target slot is the source slot. Manual moves have no
  // source slot, so the sync is skipped for them.
  useEffect(() => {
    if (mode !== 'room' || isManual) {
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
  }, [form, isManual, mode, sourceDate, sourceDay]);

  // Keep the target period in sync with the selected lesson's period.
  useEffect(() => {
    if (!selectedPeriodId) {
      return;
    }
    if (mode === 'room') {
      if (form.getFieldValue('startingPeriod') !== selectedPeriodId) {
        form.setFieldValue('startingPeriod', selectedPeriodId);
      }
      return;
    }
    // Day move: default the target period to the selected lesson's period when
    // the user has not picked one yet; the selector can override it.
    if (!form.getFieldValue('startingPeriod')) {
      form.setFieldValue('startingPeriod', selectedPeriodId);
    }
  }, [form, mode, selectedPeriodId]);

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

  const handleTargetPeriodChange = (value: string) => {
    const startingPeriod = value || undefined;
    if (startingPeriod !== form.getFieldValue('startingPeriod')) {
      // A different period means the previously chosen room no longer applies.
      form.setFieldValue('room', undefined);
    }
    form.setFieldValue('startingPeriod', startingPeriod);
  };

  const handleModeChange = (next: MoveMode) => {
    if (next === mode) {
      return;
    }
    onModeChange?.(next);

    // Clear cross-mode state so lessons picked for one move type never leak
    // into the other. The room-move effect re-syncs date/day to the source
    // slot; a day move starts with an empty target date/day.
    form.setFieldValue('lessonIds', []);
    form.setFieldValue('startingPeriod', undefined);
    setFromRoom('');
    if (next === 'day') {
      form.setFieldValue('date', undefined);
      form.setFieldValue('startingDay', undefined);
    }
  };

  // Switching source clears both sources' selections so a timetable and a
  // manual move never leak into one another (create only — edit is disabled).
  const handleSourceChange = (next: SourceMode) => {
    if (next === source) {
      return;
    }
    setSource(next);
    form.setFieldValue('lessonIds', []);
    form.setFieldValue('manualCohortIds', []);
    form.setFieldValue('manualSourceRoomId', undefined);
    form.setFieldValue('manualSubjectId', undefined);
    form.setFieldValue('manualTeacherIds', []);
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

          <SourceToggle
            disabled={Boolean(item)}
            onChange={handleSourceChange}
            source={source}
          />

          {!isManual && (
            <MoveModeToggle mode={mode} onChange={handleModeChange} />
          )}

          <form
            className="mt-4 space-y-4"
            id={formId}
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            {isManual ? (
              <ManualSourceSection
                classrooms={classrooms}
                cohorts={cohorts}
                form={form}
              />
            ) : (
              <MovedLessonSourceFields
                classrooms={classrooms}
                cohorts={cohorts}
                formLessonIds={formLessonIds}
                fromRoom={fromRoom}
                hasSlotContext={hasSlotContext}
                lessons={visibleLessons}
                mode={mode}
                onCohortChange={handleCohortChange}
                onFromRoomChange={handleFromRoomChange}
                onSourceDateChange={handleSourceDateChange}
                onToggleLesson={toggleLesson}
                selectedCohort={selectedCohort}
                selectedPeriodId={selectedPeriodId}
                sourceDate={sourceDate}
              />
            )}

            <MovedLessonTargetFields
              checkAvailability={!isManual}
              classrooms={classrooms}
              isLoadingRooms={availableClassroomsQuery.isLoading}
              mode={isManual ? 'day' : mode}
              onPeriodChange={handleTargetPeriodChange}
              onTargetDateChange={handleTargetDateChange}
              onTargetRoomChange={handleTargetRoomChange}
              periods={periodsQuery.data ?? []}
              roomOptions={roomOptions}
              startingPeriod={formStartingPeriod ?? ''}
              targetDate={formDate instanceof Date ? formDate : undefined}
              targetRoom={formRoom ?? ''}
            />

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
            disabled={!isValid || form.state.isSubmitting}
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
