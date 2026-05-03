import { useForm, useStore } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
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
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { BaseDialogProps } from './admin.types';

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionItem = NonNullable<SubstitutionApiResponse['data']>[number];
type EnrichedLesson = NonNullable<SubstitutionItem['lessons'][number]>;
type Teacher = NonNullable<SubstitutionItem['teacher']>;

type TeacherLessonsApiResponse = InferResponseType<
  typeof api.timetable.lessons.getSubstitutionCandidates.$post
>;
type TeacherLesson = NonNullable<
  NonNullable<TeacherLessonsApiResponse['data']>['availableLessons'][number]
>;

type SubstitutionDialogProps = BaseDialogProps & {
  item?: SubstitutionItem | null;
  onSubmit: (
    payload: InferRequestType<typeof api.timetable.substitutions.$post>['json']
  ) => Promise<void>;
  teachers: Teacher[];
};

function formatLessonLabel(
  lesson: Partial<EnrichedLesson> & { id: string }
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
    parts.push(`(${lesson.cohorts.join(', ')})`);
  }
  return parts.join(' - ') || lesson.id;
}

const initialState = (
  item?: SubstitutionItem | null
): InferRequestType<typeof api.timetable.substitutions.$post>['json'] => ({
  date: item?.substitution.date ? new Date(item.substitution.date) : new Date(),
  lessonIds:
    item?.lessons
      .map((l) => l?.id)
      .filter((v) => v !== undefined && v !== null) ?? [],
  substituter: item?.substitution.substituter ?? null,
});

export function SubstitutionDialog({
  item,
  onOpenChange,
  onSubmit,
  open,
  teachers,
}: SubstitutionDialogProps) {
  const { t } = useTranslation();
  const [selectedMissingTeacher, setSelectedMissingTeacher] =
    useState<string>('');
  const defaultValues = useMemo(() => initialState(item), [item]);

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  const formDate = useStore(form.store, (state) => state.values.date);
  const formLessonIds = useStore(form.store, (state) => state.values.lessonIds);
  const formSubstituter = useStore(
    form.store,
    (state) => state.values.substituter
  );

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

  const substituteCandidatesQuery = useQuery({
    enabled: !!formDate && teachers.length > 0 && !!selectedMissingTeacher,
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

  const substituteOptions = useMemo(() => {
    const candidates =
      substituteCandidatesQuery.data?.substituteCandidates ?? [];

    return candidates.map((candidate) => ({
      label: `${candidate.teacher.firstName} ${candidate.teacher.lastName} (${candidate.teacher.short})${
        candidate.hasLessonBeforeOrAfter
          ? ` - ${t('substitution.nearbyTeacherTag')}`
          : ''
      }`,
      value: candidate.teacher.id,
    }));
  }, [substituteCandidatesQuery.data, t]);

  const isCreate = !item;

  const isValid = !!formDate && formLessonIds.length > 0;

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

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>
              {isCreate ? t('substitution.create') : t('substitution.edit')}
            </DialogTitle>
          </DialogHeader>
          <form
            className="mt-4 space-y-4"
            id="substitutionForm"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className="space-y-2">
              <Label>{t('substitution.date')}</Label>
              <DatePicker
                date={formDate}
                onDateChange={(d) => {
                  form.setFieldValue('date', d ?? new Date());
                  form.setFieldValue('lessonIds', []);
                  form.setFieldValue('substituter', null);
                }}
                placeholder={t('substitution.datePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('substitution.missingTeacher')}</Label>
              <Combobox
                emptyMessage={t('substitution.noTeachersFound')}
                onValueChange={(value) => {
                  setSelectedMissingTeacher(value);
                  form.setFieldValue('lessonIds', []);
                  form.setFieldValue('substituter', null);
                }}
                options={[
                  ...teachers.map((teacher) => ({
                    label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
                    value: teacher.id,
                  })),
                ]}
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
                {selectedMissingTeacher &&
                  substituteCandidatesQuery.isLoading && (
                    <p className="p-2 text-muted-foreground text-sm">
                      {t('substitution.loadingLessons')}
                    </p>
                  )}
                {selectedMissingTeacher &&
                  !substituteCandidatesQuery.isLoading &&
                  availableLessons.length === 0 && (
                    <p className="p-2 text-muted-foreground text-sm">
                      {t('substitution.noLessons')}
                    </p>
                  )}
                {selectedMissingTeacher &&
                  !substituteCandidatesQuery.isLoading &&
                  availableLessons.length > 0 &&
                  availableLessons.map((lesson) => (
                    <label
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      htmlFor={`sub-lesson-${lesson.id}`}
                      key={lesson.id}
                    >
                      <Checkbox
                        checked={formLessonIds.includes(lesson.id)}
                        id={`sub-lesson-${lesson.id}`}
                        onCheckedChange={(checked) =>
                          toggleLesson(lesson.id, !!checked)
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
                onValueChange={(value) =>
                  form.setFieldValue(
                    'substituter',
                    value === '__none__' ? null : value || null
                  )
                }
                options={[
                  {
                    label: t('substitution.cancelled'),
                    value: '__none__',
                  },
                  ...substituteOptions,
                ]}
                placeholder={t('substitution.substituteTeacher')}
                searchPlaceholder={t('search')}
                value={formSubstituter ?? '__none__'}
              />
              <p className="text-muted-foreground text-xs">
                {t('substitution.substituteTeacherHint')}
              </p>
              {substituteCandidatesQuery.isLoading && (
                <p className="text-muted-foreground text-xs">
                  {t('substitution.loadingSubstituteTeachers')}
                </p>
              )}
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
