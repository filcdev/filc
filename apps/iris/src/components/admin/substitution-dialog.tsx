import { useForm, useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { Hand, Save } from 'lucide-react';
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
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionItem = NonNullable<SubstitutionApiResponse['data']>[number];
type Teacher = NonNullable<SubstitutionItem['teacher']>;

type TeacherLessonsApiResponse = InferResponseType<
  typeof api.timetable.lessons.getSubstitutionCandidates.$post
>;
type TeacherLesson = NonNullable<
  NonNullable<TeacherLessonsApiResponse['data']>['availableLessons'][number]
>;

type SubjectApiResponse = InferResponseType<typeof api.timetable.subjects.$get>;
type Subject = NonNullable<SubjectApiResponse['data']>[number];

type DayDefinition = NonNullable<EnrichedLesson['day']>;
type Period = NonNullable<EnrichedLesson['period']>;

// Build unique day options from the available lessons of all teachers.
function dedupeDays(lessons: TeacherLesson[]): DayDefinition[] {
  const seen = new Map<string, DayDefinition>();
  for (const lesson of lessons) {
    const day = lesson.day;
    if (day?.id && !seen.has(day.id)) {
      seen.set(day.id, day);
    }
  }
  return [...seen.values()];
}

// Build unique period options from the available lessons of all teachers.
function dedupePeriods(lessons: TeacherLesson[]): Period[] {
  const seen = new Map<string, Period>();
  for (const lesson of lessons) {
    const period = lesson.period;
    if (period?.id && !seen.has(period.id)) {
      seen.set(period.id, period);
    }
  }
  return [...seen.values()];
}

type SubstitutionDialogProps = BaseDialogProps & {
  item?: SubstitutionItem | null;
  manual?: boolean;
  onManualChange?: (manual: boolean) => void;
  onSubmit: (
    payload: InferRequestType<typeof api.timetable.substitutions.$post>['json']
  ) => Promise<void>;
  onSubmitManual: (
    payload: InferRequestType<
      typeof api.timetable.substitutions.manual.$post
    >['json']
  ) => Promise<void>;
  teachers: Teacher[];
};

// Normalise to UTC midnight using local calendar date so the PostgreSQL DATE
// column always stores the day the user actually selected, regardless of
// their UTC offset.
const toUTCDate = (d: Date): Date =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

function formatLessonLabel(
  lesson: Partial<TeacherLesson> & { id: string }
): string {
  if (!lesson) {
    return '';
  }
  const parts: string[] = [];
  if (lesson.subject?.short) {
    parts.push(lesson.subject.short);
  }
  if (lesson.day?.short) {
    parts.push(lesson.day.short);
  }
  if (lesson.period?.period) {
    parts.push(`${lesson.period.period}. óra`);
  }
  if (lesson.cohorts && lesson.cohorts.length > 0) {
    const cohortLabels = lesson.cohorts.map((c) =>
      typeof c === 'string' ? c : (c.short ?? c.name)
    );
    parts.push(`(${cohortLabels.join(', ')})`);
  }
  return parts.join(' - ') || lesson.id;
}

const initialState = (
  item?: SubstitutionItem | null
): InferRequestType<typeof api.timetable.substitutions.$post>['json'] => ({
  comment: item?.substitution.comment ?? null,
  date: toUTCDate(
    item?.substitution.date ? new Date(item.substitution.date) : new Date()
  ),
  lessonIds:
    item?.lessons
      .map((l) => l?.id)
      .filter((v) => v !== undefined && v !== null) ?? [],
  substituter: item?.substitution.substituter ?? null,
});

function compareSubOptions(
  a: { hasH1: boolean; hasH2: boolean; label: string },
  b: { hasH1: boolean; hasH2: boolean; label: string }
): number {
  if (a.hasH1 && !b.hasH1) {
    return -1;
  }
  if (!a.hasH1 && b.hasH1) {
    return 1;
  }
  if (a.hasH2 && !b.hasH2) {
    return -1;
  }
  if (!a.hasH2 && b.hasH2) {
    return 1;
  }
  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
}

type ManualSubstitutionFieldsProps = {
  cohorts: NonNullable<InferResponseType<typeof api.cohort.index.$get>['data']>;
  days: DayDefinition[];
  manualCohort: string;
  manualDay: string;
  manualPeriod: string;
  manualSubject: string;
  manualSubstituter: string;
  manualTeacher: string;
  periods: Period[];
  subjects: Subject[];
  teachers: Teacher[];
  onCohortChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onSubstituterChange: (value: string) => void;
  onTeacherChange: (value: string) => void;
};

function ManualSubstitutionFields({
  cohorts,
  days,
  manualCohort,
  manualDay,
  manualPeriod,
  manualSubject,
  manualSubstituter,
  manualTeacher,
  periods,
  subjects,
  teachers,
  onCohortChange,
  onDayChange,
  onPeriodChange,
  onSubjectChange,
  onSubstituterChange,
  onTeacherChange,
}: ManualSubstitutionFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-2">
        <Label>{t('substitution.missingTeacher')}</Label>
        <Combobox
          emptyMessage={t('substitution.noTeachersFound')}
          onValueChange={onTeacherChange}
          options={teachers.map((teacher) => ({
            label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
            value: teacher.id,
          }))}
          placeholder={t('substitution.missingTeacherPlaceholder')}
          searchPlaceholder={t('search')}
          value={manualTeacher}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('substitution.day')}</Label>
          <Combobox
            emptyMessage={t('substitution.noDaysFound')}
            onValueChange={onDayChange}
            options={days.map((day) => ({
              label: day.name,
              value: day.id,
            }))}
            placeholder={t('substitution.dayPlaceholder')}
            searchPlaceholder={t('search')}
            value={manualDay}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('substitution.period')}</Label>
          <Combobox
            emptyMessage={t('substitution.noPeriodsFound')}
            onValueChange={onPeriodChange}
            options={periods.map((period) => ({
              label: `${period.period}. (${period.startTime.slice(0, 5)} - ${period.endTime.slice(0, 5)})`,
              value: period.id,
            }))}
            placeholder={t('substitution.periodPlaceholder')}
            searchPlaceholder={t('search')}
            value={manualPeriod}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.subject')}</Label>
        <Combobox
          emptyMessage={t('substitution.noSubjectsFound')}
          onValueChange={onSubjectChange}
          options={subjects.map((subject) => ({
            label: `${subject.name} (${subject.short})`,
            value: subject.id,
          }))}
          placeholder={t('substitution.subjectPlaceholder')}
          searchPlaceholder={t('search')}
          value={manualSubject}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.cohort')}</Label>
        <Combobox
          emptyMessage={t('substitution.noCohortFound')}
          onValueChange={onCohortChange}
          options={cohorts.map((cohort) => ({
            label: cohort.name,
            value: cohort.id,
          }))}
          placeholder={t('substitution.cohortPlaceholder')}
          searchPlaceholder={t('search')}
          value={manualCohort}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.substituteTeacher')}</Label>
        <Combobox
          emptyMessage={t('substitution.selectLessonsFirst')}
          onValueChange={onSubstituterChange}
          options={[
            {
              label: t('substitution.cancelled'),
              value: '__none__',
            },
            ...teachers
              .filter((teacher) => teacher.id !== manualTeacher)
              .map((teacher) => ({
                label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
                value: teacher.id,
              })),
          ]}
          placeholder={t('substitution.substituteTeacher')}
          searchPlaceholder={t('search')}
          value={manualSubstituter || '__none__'}
        />
        <p className="text-muted-foreground text-xs">
          {t('substitution.substituteTeacherHint')}
        </p>
      </div>
    </>
  );
}

type AutomaticSubstitutionFieldsProps = {
  availableLessons: TeacherLesson[];
  formDate: Date | undefined;
  formLessonIds: string[];
  formSubstituter: string | null | undefined;
  parallelTeachers: { id: string; name: string }[];
  selectedMissingTeacher: string;
  sortedSubstituteOptions: {
    hasH1: boolean;
    hasH2: boolean;
    label: string;
    value: string;
  }[];
  substituteCandidatesLoading: boolean;
  teachers: Teacher[];
  onMissingTeacherChange: (value: string) => void;
  onSubstituterChange: (value: string) => void;
  onToggleLesson: (lessonId: string, checked: boolean) => void;
};

function AutomaticSubstitutionFields({
  availableLessons,
  formDate,
  formLessonIds,
  formSubstituter,
  parallelTeachers,
  selectedMissingTeacher,
  sortedSubstituteOptions,
  substituteCandidatesLoading,
  teachers,
  onMissingTeacherChange,
  onSubstituterChange,
  onToggleLesson,
}: AutomaticSubstitutionFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-2">
        <Label>{t('substitution.missingTeacher')}</Label>
        <Combobox
          emptyMessage={t('substitution.noTeachersFound')}
          onValueChange={onMissingTeacherChange}
          options={teachers.map((teacher) => ({
            label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
            value: teacher.id,
          }))}
          placeholder={t('substitution.missingTeacherPlaceholder')}
          searchPlaceholder={t('search')}
          value={selectedMissingTeacher}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.lessons')}</Label>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
          {!selectedMissingTeacher && (
            <p className="p-2 text-muted-foreground text-sm">
              {t('substitution.missingTeacherPlaceholder')}
            </p>
          )}
          {selectedMissingTeacher && substituteCandidatesLoading && (
            <p className="p-2 text-muted-foreground text-sm">
              {t('substitution.loadingLessons')}
            </p>
          )}
          {selectedMissingTeacher &&
            !substituteCandidatesLoading &&
            availableLessons.length === 0 && (
              <p className="p-2 text-muted-foreground text-sm">
                {t('substitution.noLessons')}
              </p>
            )}
          {selectedMissingTeacher &&
            !substituteCandidatesLoading &&
            availableLessons.length > 0 &&
            [...availableLessons]
              .sort((a, b) => (a.period?.period ?? 0) - (b.period?.period ?? 0))
              .map((lesson) => (
                <label
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  htmlFor={`sub-lesson-${lesson.id}`}
                  key={lesson.id}
                >
                  <Checkbox
                    checked={formLessonIds.includes(lesson.id)}
                    id={`sub-lesson-${lesson.id}`}
                    onCheckedChange={(checked) =>
                      onToggleLesson(lesson.id, !!checked)
                    }
                  />
                  <span>{formatLessonLabel(lesson)}</span>
                </label>
              ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.substituteTeacher')}</Label>
        <Combobox
          emptyMessage={
            selectedMissingTeacher && formLessonIds.length > 0
              ? t('substitution.noAvailableSubstituteTeachers')
              : t('substitution.selectLessonsFirst')
          }
          key={`substitute-${selectedMissingTeacher}-${formDate?.toISOString() ?? 'no-date'}-${[...formLessonIds].sort().join(',')}`}
          onValueChange={onSubstituterChange}
          options={[
            {
              label: t('substitution.cancelled'),
              value: '__none__',
            },
            ...parallelTeachers.map((teacher) => ({
              label: `${t('substitution.merged')} - ${teacher.name}`,
              value: `__merged__:${teacher.id}`,
            })),
            ...sortedSubstituteOptions,
          ]}
          placeholder={t('substitution.substituteTeacher')}
          searchPlaceholder={t('search')}
          value={formSubstituter ?? '__none__'}
        />
        <p className="text-muted-foreground text-xs">
          {t('substitution.substituteTeacherHint')}
        </p>
        {substituteCandidatesLoading && (
          <p className="text-muted-foreground text-xs">
            {t('substitution.loadingSubstituteTeachers')}
          </p>
        )}
      </div>
    </>
  );
}

function isSubstitutionValid(params: {
  formDate: Date | undefined;
  formLessonIds: string[];
  manual: boolean;
  manualCohort: string;
  manualDay: string;
  manualPeriod: string;
  manualSubject: string;
  manualTeacher: string;
}): boolean {
  const {
    formDate,
    formLessonIds,
    manual,
    manualCohort,
    manualDay,
    manualPeriod,
    manualSubject,
    manualTeacher,
  } = params;

  if (manual) {
    return (
      !!formDate &&
      !!manualTeacher &&
      !!manualDay &&
      !!manualPeriod &&
      !!manualSubject &&
      !!manualCohort
    );
  }

  return !!formDate && formLessonIds.length > 0;
}

type ManualModeToggleProps = {
  manual: boolean;
  onToggle: () => void;
};

function ManualModeToggle({ manual, onToggle }: ManualModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
      <Hand className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="font-medium text-sm">{t('substitution.manualMode')}</p>
        <p className="text-muted-foreground text-xs">
          {t('substitution.manualModeHint')}
        </p>
      </div>
      <Button
        onClick={onToggle}
        size="sm"
        variant={manual ? 'default' : 'outline'}
      >
        {manual
          ? t('substitution.manualModeOn')
          : t('substitution.manualModeOff')}
      </Button>
    </div>
  );
}

export function SubstitutionDialog({
  item,
  manual = false,
  onManualChange,
  onOpenChange,
  onSubmit,
  onSubmitManual,
  open,
  teachers,
}: SubstitutionDialogProps) {
  const { t } = useTranslation();
  const [selectedMissingTeacher, setSelectedMissingTeacher] =
    useState<string>('');
  const [manualTeacher, setManualTeacher] = useState<string>('');
  const [manualDay, setManualDay] = useState<string>('');
  const [manualPeriod, setManualPeriod] = useState<string>('');
  const [manualSubject, setManualSubject] = useState<string>('');
  const [manualCohort, setManualCohort] = useState<string>('');
  const [manualSubstituter, setManualSubstituter] = useState<string>('');
  const defaultValues = useMemo(() => initialState(item), [item]);
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      const resolvedSubstituter = value.substituter?.startsWith('__merged__:')
        ? value.substituter.slice('__merged__:'.length)
        : value.substituter;
      await onSubmit({ ...value, substituter: resolvedSubstituter });
    },
  });

  const formDate = useStore(form.store, (state) => state.values.date);
  const formLessonIds = useStore(form.store, (state) => state.values.lessonIds);
  const formSubstituter = useStore(
    form.store,
    (state) => state.values.substituter
  );
  const formComment = useStore(form.store, (state) => state.values.comment);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(defaultValues);
    if (item && item.lessons.length > 0) {
      const firstLesson = item.lessons[0];
      const firstTeacherId = firstLesson?.teachers?.[0]?.id;
      setSelectedMissingTeacher(firstTeacherId ?? '');
    } else {
      setSelectedMissingTeacher('');
    }
  }, [defaultValues, form, item, open]);

  const subjectsQuery = useQuery({
    enabled: manual,
    queryFn: async (): Promise<Subject[]> => {
      const res = await parseResponse(api.timetable.subjects.$get());
      if (!res.success) {
        throw new Error('Failed to load subjects');
      }
      return res.data as Subject[];
    },
    queryKey: ['subjects'],
  });

  const cohortsQuery = useQuery({
    enabled: manual,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data;
    },
    queryKey: queryKeys.cohorts(),
  });

  const substituteCandidatesQuery = useQuery({
    enabled:
      !manual && !!formDate && teachers.length > 0 && !!selectedMissingTeacher,
    queryFn: async () => {
      const res = await parseResponse(
        api.timetable.lessons.getSubstitutionCandidates.$post({
          json: {
            date: formDate,
            missingTeacherId: selectedMissingTeacher,
            selectedLessonIds: formLessonIds,
            teacherIds: teachers.map((teacher) => teacher.id),
          },
        })
      );

      if (!res.success) {
        throw new Error('Failed to load substitution candidates');
      }

      return res.data;
    },
    queryKey: queryKeys.timetable.substituteCandidates(
      selectedMissingTeacher,
      formDate?.toISOString(),
      [...formLessonIds].sort().join(','),
      teachers
        .map((teacher) => teacher.id)
        .sort()
        .join(',')
    ),
  });

  const availableLessons = useMemo(() => {
    if (!selectedMissingTeacher) {
      return [];
    }

    return (substituteCandidatesQuery.data?.availableLessons ??
      []) as TeacherLesson[];
  }, [selectedMissingTeacher, substituteCandidatesQuery.data]);

  const parallelTeachers = useMemo(() => {
    const parallelLessons =
      substituteCandidatesQuery.data?.parallelLessons ?? [];
    const selectedSubjectIds = new Set(
      availableLessons
        .filter((l) => formLessonIds.includes(l.id) && l.subject)
        .map((l) => l.subject?.id)
    );
    const seen = new Map<string, { id: string; name: string }>();
    for (const lesson of parallelLessons) {
      if (!(lesson.subject && selectedSubjectIds.has(lesson.subject.id))) {
        continue;
      }
      for (const teacher of lesson.teachers ?? []) {
        if (!seen.has(teacher.id)) {
          seen.set(teacher.id, { id: teacher.id, name: teacher.name });
        }
      }
    }
    return [...seen.values()];
  }, [substituteCandidatesQuery.data, availableLessons, formLessonIds]);

  const substituteOptions = useMemo(() => {
    const candidates =
      substituteCandidatesQuery.data?.substituteCandidates ?? [];

    return candidates.map((candidate) => {
      let tag = '';
      if (candidate.hasH1 && candidate.hasH2) {
        tag = ` - ${t('substitution.nearbyTeacherTag')}`;
      } else if (candidate.hasH1) {
        tag = ` - ${t('substitution.h1Tag')}`;
      } else if (candidate.hasH2) {
        tag = ` - ${t('substitution.h2Tag')}`;
      }

      return {
        hasH1: candidate.hasH1,
        hasH2: candidate.hasH2,
        label: `${candidate.teacher.firstName} ${candidate.teacher.lastName} (${candidate.teacher.short})${tag}`,
        value: candidate.teacher.id,
      };
    });
  }, [substituteCandidatesQuery.data, t]);

  const sortedSubstituteOptions = useMemo(() => {
    return [...substituteOptions].sort(compareSubOptions);
  }, [substituteOptions]);

  const isCreate = !item;

  const isValid = isSubstitutionValid({
    formDate,
    formLessonIds,
    manual,
    manualCohort,
    manualDay,
    manualPeriod,
    manualSubject,
    manualTeacher,
  });

  const toggleLesson = (lessonId: string, checked: boolean) => {
    const current = form.getFieldValue('lessonIds');
    if (checked) {
      form.setFieldValue(
        'lessonIds',
        Array.from(new Set([...current, lessonId]))
      );
    } else {
      form.setFieldValue(
        'lessonIds',
        current.filter((id) => id !== lessonId)
      );
    }
    form.setFieldValue('substituter', null);
  };

  const handleManualSubmit = async () => {
    await onSubmitManual({
      cohortId: manualCohort,
      comment: formComment || null,
      date: formDate,
      dayDefinitionId: manualDay,
      periodId: manualPeriod,
      subjectId: manualSubject,
      substituter: manualSubstituter || null,
      teacherId: manualTeacher,
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {isCreate ? t('substitution.create') : t('substitution.edit')}
            </DialogTitle>
          </DialogHeader>

          {isCreate && (
            <ManualModeToggle
              manual={manual}
              onToggle={() => onManualChange?.(!manual)}
            />
          )}

          <form
            className="mt-4 space-y-4"
            id="substitutionForm"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual) {
                handleManualSubmit();
              } else {
                form.handleSubmit();
              }
            }}
          >
            <div className="space-y-2">
              <Label>{t('substitution.date')}</Label>
              <DatePicker
                date={formDate}
                onDateChange={(d) => {
                  form.setFieldValue('date', toUTCDate(d ?? new Date()));
                  form.setFieldValue('lessonIds', []);
                  form.setFieldValue('substituter', null);
                }}
                placeholder={t('substitution.datePlaceholder')}
              />
            </div>

            {manual ? (
              <ManualSubstitutionFields
                cohorts={cohortsQuery.data ?? []}
                days={dedupeDays(
                  (substituteCandidatesQuery.data?.availableLessons ??
                    []) as TeacherLesson[]
                )}
                manualCohort={manualCohort}
                manualDay={manualDay}
                manualPeriod={manualPeriod}
                manualSubject={manualSubject}
                manualSubstituter={manualSubstituter}
                manualTeacher={manualTeacher}
                onCohortChange={setManualCohort}
                onDayChange={setManualDay}
                onPeriodChange={setManualPeriod}
                onSubjectChange={setManualSubject}
                onSubstituterChange={(value) =>
                  setManualSubstituter(value || '')
                }
                onTeacherChange={setManualTeacher}
                periods={dedupePeriods(
                  (substituteCandidatesQuery.data?.availableLessons ??
                    []) as TeacherLesson[]
                )}
                subjects={subjectsQuery.data ?? []}
                teachers={teachers}
              />
            ) : (
              <AutomaticSubstitutionFields
                availableLessons={availableLessons}
                formDate={formDate}
                formLessonIds={formLessonIds}
                formSubstituter={formSubstituter}
                onMissingTeacherChange={(value) => {
                  setSelectedMissingTeacher(value);
                  form.setFieldValue('lessonIds', []);
                  form.setFieldValue('substituter', null);
                }}
                onSubstituterChange={(value) =>
                  form.setFieldValue(
                    'substituter',
                    value === '__none__' ? null : value || null
                  )
                }
                onToggleLesson={toggleLesson}
                parallelTeachers={parallelTeachers}
                selectedMissingTeacher={selectedMissingTeacher}
                sortedSubstituteOptions={sortedSubstituteOptions}
                substituteCandidatesLoading={
                  substituteCandidatesQuery.isLoading
                }
                teachers={teachers}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="substitution-comment">
                {t('substitution.comment')}
              </Label>
              <Textarea
                id="substitution-comment"
                onChange={(e) =>
                  form.setFieldValue('comment', e.target.value || null)
                }
                placeholder={t('substitution.commentPlaceholder')}
                value={formComment ?? ''}
              />
            </div>
          </form>
        </div>

        <DialogFooter className="border-t p-4">
          <Button
            disabled={!isValid || form.state.isSubmitting}
            form="substitutionForm"
            type="submit"
          >
            <Save className="h-4 w-4" />
            {isCreate ? t('substitution.create') : t('substitution.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
