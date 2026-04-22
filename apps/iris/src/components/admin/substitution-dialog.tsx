import { useQuery } from '@tanstack/react-query';
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
import { api } from '@/utils/hc';

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

type SubstitutionDialogProps = {
  isSubmitting: boolean;
  item?: SubstitutionItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    payload: InferRequestType<typeof api.timetable.substitutions.$post>['json']
  ) => Promise<void>;
  open: boolean;
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
  isSubmitting,
  item,
  onOpenChange,
  onSubmit,
  open,
  teachers,
}: SubstitutionDialogProps) {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<
    InferRequestType<typeof api.timetable.substitutions.$post>['json']
  >(initialState(item));
  const [selectedMissingTeacher, setSelectedMissingTeacher] =
    useState<string>('');

  useEffect(() => {
    setFormState(initialState(item));
    // Automatically select teacher when editing based on the first lesson's teacher.
    if (item && item.lessons.length > 0) {
      const firstLesson = item.lessons[0];
      const firstTeacherId = firstLesson?.teachers?.[0]?.id;
      if (firstTeacherId) {
        setSelectedMissingTeacher(firstTeacherId);
      } else {
        setSelectedMissingTeacher('');
      }
    } else {
      setSelectedMissingTeacher('');
    }
  }, [item]);

  const substituteCandidatesQuery = useQuery({
    enabled:
      !!formState.date && teachers.length > 0 && !!selectedMissingTeacher,
    queryFn: async () => {
      const res = await parseResponse(
        api.timetable.lessons.getSubstitutionCandidates.$post({
          json: {
            date: formState.date,
            missingTeacherId: selectedMissingTeacher,
            selectedLessonIds: formState.lessonIds,
            teacherIds: teachers.map((teacher) => teacher.id),
          },
        })
      );

      if (!res.success) {
        throw new Error('Failed to load substitution candidates');
      }

      return res.data;
    },
    queryKey: [
      'substitute-candidates',
      selectedMissingTeacher,
      formState.date?.toISOString(),
      [...formState.lessonIds].sort().join(','),
      teachers
        .map((teacher) => teacher.id)
        .sort()
        .join(','),
    ],
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

  const isValid = useMemo(() => {
    if (!formState.date) {
      return false;
    }
    if (formState.lessonIds.length === 0) {
      return false;
    }
    return true;
  }, [formState.date, formState.lessonIds]);

  const toggleLesson = (lessonId: string, checked: boolean) => {
    setFormState((prev) => {
      if (checked) {
        return {
          ...prev,
          lessonIds: Array.from(new Set([...prev.lessonIds, lessonId])),
          substituter: null,
        };
      }
      return {
        ...prev,
        lessonIds: prev.lessonIds.filter((id) => id !== lessonId),
        substituter: null,
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
              {isCreate ? t('substitution.create') : t('substitution.edit')}
            </DialogTitle>
          </DialogHeader>
          <form
            className="mt-4 space-y-4"
            id="substitutionForm"
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label>{t('substitution.date')}</Label>
              <DatePicker
                date={formState.date}
                onDateChange={(d) =>
                  setFormState((prev) => ({
                    ...prev,
                    date: d ?? new Date(),
                    lessonIds: [],
                    substituter: null,
                  }))
                }
                placeholder={t('substitution.datePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('substitution.missingTeacher')}</Label>
              <Combobox
                emptyMessage={t('substitution.noTeachersFound')}
                onValueChange={(value) => {
                  setSelectedMissingTeacher(value);
                  setFormState((prev) => ({
                    ...prev,
                    lessonIds: [],
                    substituter: null,
                  }));
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
                        checked={formState.lessonIds.includes(lesson.id)}
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
                  selectedMissingTeacher && formState.lessonIds.length > 0
                    ? t('substitution.noAvailableSubstituteTeachers')
                    : t('substitution.selectLessonsFirst')
                }
                key={`substitute-${selectedMissingTeacher}-${formState.date?.toISOString() ?? 'no-date'}-${[...formState.lessonIds].sort().join(',')}`}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    substituter: value === '__none__' ? null : value || null,
                  }))
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
                value={formState.substituter ?? '__none__'}
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
            disabled={!isValid || isSubmitting}
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
