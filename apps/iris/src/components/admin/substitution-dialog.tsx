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
import { isMatchingWeekday } from '@/utils/date-locale';
import { api } from '@/utils/hc';

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionItem = NonNullable<SubstitutionApiResponse['data']>[number];
type EnrichedLesson = NonNullable<SubstitutionItem['lessons'][number]>;
type Teacher = NonNullable<SubstitutionItem['teacher']>;

type CohortApiResponse = InferResponseType<typeof api.cohort.index.$get>;
type Cohort = NonNullable<CohortApiResponse['data']>[number];

type SubstitutionDialogProps = {
  cohorts: Cohort[];
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
  cohorts,
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
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  useEffect(() => {
    setFormState(initialState(item));
    // Automatically select cohort when editing based on the first lesson's cohort
    if (item && item.lessons.length > 0) {
      const firstLesson = item.lessons[0];
      if (firstLesson && firstLesson.cohorts.length > 0) {
        const cohortName = firstLesson.cohorts[0];
        const matchingCohort = cohorts.find((c) => c.name === cohortName);
        if (matchingCohort) {
          setSelectedCohort(matchingCohort.id);
        } else {
          setSelectedCohort('');
        }
      } else {
        setSelectedCohort('');
      }
    } else {
      setSelectedCohort('');
    }
  }, [item, cohorts]);

  const cohortLessonsQuery = useQuery({
    enabled: !!selectedCohort && !!formState.date,
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
    queryKey: [
      'lessons',
      'cohort',
      selectedCohort,
      formState.date?.toISOString(),
    ],
  });

  // Filter lessons by the selected date's day of week
  const filteredLessonsByDate = useMemo(() => {
    if (!formState.date) {
      return [];
    }
    if (!cohortLessonsQuery.data || cohortLessonsQuery.data.length === 0) {
      return [];
    }

    // Get day of week from selected date (0 = Sunday, 1 = Monday, etc.)
    const selectedDayOfWeek = formState.date.getDay();

    return cohortLessonsQuery.data.filter((lesson) => {
      if (!lesson.day) {
        return false;
      }
      // Match backend day labels in either Hungarian or English.
      return isMatchingWeekday(
        selectedDayOfWeek,
        lesson.day.name,
        lesson.day.short
      );
    });
  }, [formState.date, cohortLessonsQuery.data]);

  const availableLessons = useMemo(() => {
    // Only show lessons from the selected cohort, filtered by date
    if (!selectedCohort) {
      return [];
    }
    if (!formState.date) {
      return [];
    }

    return filteredLessonsByDate;
  }, [selectedCohort, formState.date, filteredLessonsByDate]);

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
        };
      }
      return {
        ...prev,
        lessonIds: prev.lessonIds.filter((id) => id !== lessonId),
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
                  }))
                }
                placeholder={t('substitution.datePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('substitution.substituteTeacher')}</Label>
              <Combobox
                emptyMessage={t('substitution.noTeachersFound')}
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
                  ...teachers.map((teacher) => ({
                    label: `${teacher.firstName} ${teacher.lastName} (${teacher.short})`,
                    value: teacher.id,
                  })),
                ]}
                placeholder={t('substitution.substituteTeacher')}
                searchPlaceholder={t('search')}
                value={formState.substituter ?? '__none__'}
              />
              <p className="text-muted-foreground text-xs">
                {t('substitution.substituteTeacherHint')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('substitution.selectCohort')}</Label>
              <Combobox
                emptyMessage={t('substitution.noCohortFound')}
                onValueChange={(v) => setSelectedCohort(v)}
                options={cohorts.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
                placeholder={t('substitution.selectCohortPlaceholder')}
                searchPlaceholder={t('search')}
                value={selectedCohort}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('substitution.lessons')}</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {!selectedCohort && (
                  <p className="p-2 text-muted-foreground text-sm">
                    {t('substitution.selectCohortPlaceholder')}
                  </p>
                )}
                {selectedCohort && cohortLessonsQuery.isLoading && (
                  <p className="p-2 text-muted-foreground text-sm">
                    {t('substitution.loadingLessons')}
                  </p>
                )}
                {selectedCohort &&
                  !cohortLessonsQuery.isLoading &&
                  availableLessons.length === 0 && (
                    <p className="p-2 text-muted-foreground text-sm">
                      {t('substitution.noLessons')}
                    </p>
                  )}
                {selectedCohort &&
                  !cohortLessonsQuery.isLoading &&
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
