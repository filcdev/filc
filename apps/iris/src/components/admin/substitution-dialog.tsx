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
import {
  type SubstitutionItem,
  type Teacher,
  useCreateManualSubstitution,
  useCreateSubstitution,
  useSubstitutionTeachers,
  useUpdateSubstitution,
} from '@/hooks/substitutions';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

type EnrichedLesson = NonNullable<SubstitutionItem['lessons'][number]>;

type TeacherLessonsApiResponse = InferResponseType<
  typeof api.timetable.lessons.getSubstitutionCandidates.$post
>;
type TeacherLesson = NonNullable<
  NonNullable<TeacherLessonsApiResponse['data']>['availableLessons'][number]
>;

type SubstitutionFormValues = InferRequestType<
  typeof api.timetable.substitutions.$post
>['json'] & {
  manualCohort: string;
  manualDay: string;
  manualPeriod: string;
  manualSubject: string;
  manualSubstituter: string;
  manualTeacher: string;
};

/**
 * The dialog's fully-typed form API. Derived from `useForm` itself because
 * TanStack's validator generics are invariant; this form instance is the DI
 * boundary between the dialog shell and its field-group components.
 */
type SubstitutionFormApi = ReturnType<
  typeof useForm<
    SubstitutionFormValues,
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
  form: SubstitutionFormApi;
  periods: Period[];
  subjects: Subject[];
  teachers: Teacher[];
};

function ManualSubstitutionFields({
  cohorts,
  days,
  form,
  periods,
  subjects,
  teachers,
}: ManualSubstitutionFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="space-y-2">
        <Label>{t('substitution.missingTeacher')}</Label>
        <form.Field name="manualTeacher">
          {(field) => (
            <Combobox
              emptyMessage={t('substitution.noTeachersFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={teachers.map((teacher) => ({
                label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
                value: teacher.id,
              }))}
              placeholder={t('substitution.missingTeacherPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('substitution.day')}</Label>
          <form.Field name="manualDay">
            {(field) => (
              <Combobox
                emptyMessage={t('substitution.noDaysFound')}
                onValueChange={(value) => field.handleChange(value)}
                options={days.map((day) => ({
                  label: day.name,
                  value: day.id,
                }))}
                placeholder={t('substitution.dayPlaceholder')}
                searchPlaceholder={t('search')}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>

        <div className="space-y-2">
          <Label>{t('substitution.period')}</Label>
          <form.Field name="manualPeriod">
            {(field) => (
              <Combobox
                emptyMessage={t('substitution.noPeriodsFound')}
                onValueChange={(value) => field.handleChange(value)}
                options={periods.map((period) => ({
                  label: `${period.period}. (${period.startTime.slice(0, 5)} - ${period.endTime.slice(0, 5)})`,
                  value: period.id,
                }))}
                placeholder={t('substitution.periodPlaceholder')}
                searchPlaceholder={t('search')}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.subject')}</Label>
        <form.Field name="manualSubject">
          {(field) => (
            <Combobox
              emptyMessage={t('substitution.noSubjectsFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={subjects.map((subject) => ({
                label: `${subject.name} (${subject.short})`,
                value: subject.id,
              }))}
              placeholder={t('substitution.subjectPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.cohort')}</Label>
        <form.Field name="manualCohort">
          {(field) => (
            <Combobox
              emptyMessage={t('substitution.noCohortFound')}
              onValueChange={(value) => field.handleChange(value)}
              options={cohorts.map((cohort) => ({
                label: cohort.name,
                value: cohort.id,
              }))}
              placeholder={t('substitution.cohortPlaceholder')}
              searchPlaceholder={t('search')}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.substituteTeacher')}</Label>
        <form.Field name="manualSubstituter">
          {(field) => (
            <Combobox
              emptyMessage={t('substitution.selectLessonsFirst')}
              onValueChange={(value) => field.handleChange(value || '')}
              options={[
                {
                  label: t('substitution.cancelled'),
                  value: '__none__',
                },
                ...teachers
                  .filter(
                    (teacher) =>
                      teacher.id !== form.getFieldValue('manualTeacher')
                  )
                  .map((teacher) => ({
                    label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
                    value: teacher.id,
                  })),
              ]}
              placeholder={t('substitution.substituteTeacher')}
              searchPlaceholder={t('search')}
              value={field.state.value || '__none__'}
            />
          )}
        </form.Field>
        <p className="text-muted-foreground text-xs">
          {t('substitution.substituteTeacherHint')}
        </p>
      </div>
    </>
  );
}

type AutomaticSubstitutionFieldsProps = {
  availableLessons: TeacherLesson[];
  form: SubstitutionFormApi;
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
  onSelectedMissingTeacherChange: (value: string) => void;
};

function AutomaticSubstitutionFields({
  availableLessons,
  form,
  parallelTeachers,
  selectedMissingTeacher,
  sortedSubstituteOptions,
  substituteCandidatesLoading,
  teachers,
  onSelectedMissingTeacherChange,
}: AutomaticSubstitutionFieldsProps) {
  const { t } = useTranslation();
  const formDate = useStore(form.store, (state) => state.values.date);
  const formLessonIds = useStore(form.store, (state) => state.values.lessonIds);
  const handleMissingTeacherChange = (value: string) => {
    // Changing the absent teacher invalidates any previously picked lessons.
    form.setFieldValue('lessonIds', []);
    form.setFieldValue('substituter', null);
    onSelectedMissingTeacherChange(value);
  };

  const toggleLessonInField = (
    field: { state: { value: string[] }; handleChange: (v: string[]) => void },
    lessonId: string,
    checked: boolean
  ) => {
    if (checked) {
      field.handleChange(Array.from(new Set([...field.state.value, lessonId])));
    } else {
      field.handleChange(field.state.value.filter((id) => id !== lessonId));
    }
    // A different lesson set invalidates the chosen substitute.
    form.setFieldValue('substituter', null);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>{t('substitution.missingTeacher')}</Label>
        <Combobox
          emptyMessage={t('substitution.noTeachersFound')}
          onValueChange={handleMissingTeacherChange}
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
            availableLessons.length > 0 && (
              <form.Field name="lessonIds">
                {(field) =>
                  [...availableLessons]
                    .sort(
                      (a, b) =>
                        (a.period?.period ?? 0) - (b.period?.period ?? 0)
                    )
                    .map((lesson) => (
                      <label
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                        htmlFor={`sub-lesson-${lesson.id}`}
                        key={lesson.id}
                      >
                        <Checkbox
                          checked={field.state.value.includes(lesson.id)}
                          id={`sub-lesson-${lesson.id}`}
                          onCheckedChange={(checked) =>
                            toggleLessonInField(field, lesson.id, !!checked)
                          }
                        />
                        <span>{formatLessonLabel(lesson)}</span>
                      </label>
                    ))
                }
              </form.Field>
            )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('substitution.substituteTeacher')}</Label>
        <form.Field name="substituter">
          {(field) => (
            <Combobox
              emptyMessage={
                selectedMissingTeacher && formLessonIds.length > 0
                  ? t('substitution.noAvailableSubstituteTeachers')
                  : t('substitution.selectLessonsFirst')
              }
              key={`substitute-${selectedMissingTeacher}-${formDate?.toISOString() ?? 'no-date'}-${[...formLessonIds].sort().join(',')}`}
              onValueChange={(value) =>
                field.handleChange(value === '__none__' ? null : value || null)
              }
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
              value={field.state.value ?? '__none__'}
            />
          )}
        </form.Field>
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
  open,
}: SubstitutionDialogProps) {
  const { t } = useTranslation();
  const close = () => onOpenChange(false);
  const createMutation = useCreateSubstitution({ onSaved: close });
  const updateMutation = useUpdateSubstitution({ onSaved: close });
  const manualMutation = useCreateManualSubstitution({ onSaved: close });
  const { data: teachers = [] } = useSubstitutionTeachers(open);
  const [selectedMissingTeacher, setSelectedMissingTeacher] =
    useState<string>('');
  const defaultValues = useMemo(
    () => ({
      ...initialState(item),
      manualCohort: '',
      manualDay: '',
      manualPeriod: '',
      manualSubject: '',
      manualSubstituter: '',
      manualTeacher: '',
    }),
    [item]
  );
  const form = useForm<
    SubstitutionFormValues,
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
      const resolvedSubstituter = value.substituter?.startsWith('__merged__:')
        ? value.substituter.slice('__merged__:'.length)
        : value.substituter;
      const {
        manualCohort: _c,
        manualDay: _d,
        manualPeriod: _p,
        manualSubject: _s,
        manualSubstituter: _ms,
        manualTeacher: _mt,
        ...payload
      } = { ...value, substituter: resolvedSubstituter };
      if (item) {
        await updateMutation.mutateAsync({
          id: item.substitution.id,
          payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
    },
  });

  const {
    comment: formComment,
    date: formDate,
    lessonIds: formLessonIds,
    manualCohort,
    manualDay,
    manualPeriod,
    manualSubject,
    manualSubstituter,
    manualTeacher,
  } = useStore(form.store, (state) => state.values);

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
    queryKey: queryKeys.subjects(),
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

  const handleManualSubmit = () => {
    manualMutation.mutateAsync({
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
                form={form}
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
                form={form}
                onSelectedMissingTeacherChange={setSelectedMissingTeacher}
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
              <form.Field name="comment">
                {(field) => (
                  <Textarea
                    id="substitution-comment"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder={t('substitution.commentPlaceholder')}
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
