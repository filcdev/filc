import { useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
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

type Teacher = {
  firstName: string;
  gender: string | null;
  id: string;
  lastName: string;
  short: string;
  userId: string | null;
};

type Cohort = {
  id: string;
  name: string;
};

type EnrichedLesson = {
  classrooms: { id: string; name: string; short: string }[];
  cohorts: string[];
  day: { id: string; name: string; short: string } | null;
  id: string;
  period: {
    endTime: string;
    id: string;
    period: number;
    startTime: string;
  } | null;
  subject: { id: string; name: string; short: string } | null;
  teachers: { id: string; name: string; short: string }[];
};

type SubstitutionItem = {
  lessons: EnrichedLesson[];
  substitution: {
    date: string;
    id: string;
    substituter: string | null;
  };
  teacher: Teacher | null;
};

type SubstitutionFormValues = {
  date: string;
  lessonIds: string[];
  substituter: string | null;
};

type SubstitutionDialogProps = {
  allLessons: EnrichedLesson[];
  cohorts: Cohort[];
  isSubmitting: boolean;
  item?: SubstitutionItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SubstitutionFormValues) => Promise<void>;
  open: boolean;
  teachers: Teacher[];
};

function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLessonLabel(lesson: EnrichedLesson): string {
  const parts: string[] = [];
  if (lesson.subject) {
    parts.push(lesson.subject.short);
  }
  if (lesson.day) {
    parts.push(lesson.day.short);
  }
  if (lesson.period) {
    parts.push(`${lesson.period.period}. óra`);
  }
  if (lesson.cohorts.length > 0) {
    parts.push(`(${lesson.cohorts.join(', ')})`);
  }
  return parts.join(' - ') || lesson.id;
}

const initialState = (
  item?: SubstitutionItem | null
): SubstitutionFormValues => ({
  date: item?.substitution.date ?? '',
  lessonIds: item?.lessons.map((l) => l.id) ?? [],
  substituter: item?.substitution.substituter ?? null,
});

export function SubstitutionDialog({
  allLessons,
  cohorts,
  isSubmitting,
  item,
  onOpenChange,
  onSubmit,
  open,
  teachers,
}: SubstitutionDialogProps) {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<SubstitutionFormValues>(
    initialState(item)
  );
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  useEffect(() => {
    setFormState(initialState(item));
    setSelectedCohort('');
  }, [item]);

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
      return (res.data ?? []).map(
        (l): EnrichedLesson => ({
          classrooms: l.classrooms,
          cohorts: [],
          day: l.day
            ? { id: l.day.id, name: l.day.name, short: l.day.short }
            : null,
          id: l.id,
          period: l.period,
          subject: l.subject,
          teachers: l.teachers,
        })
      );
    },
    queryKey: ['lessons', 'cohort', selectedCohort],
  });

  const availableLessons = useMemo(() => {
    const map = new Map<string, EnrichedLesson>();
    for (const l of allLessons) {
      map.set(l.id, l);
    }
    for (const l of cohortLessonsQuery.data ?? []) {
      map.set(l.id, l);
    }
    return Array.from(map.values());
  }, [allLessons, cohortLessonsQuery.data]);

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

  const dateAsDate = formState.date
    ? new Date(`${formState.date}T00:00:00`)
    : undefined;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? t('substitution.create') : t('substitution.edit')}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>{t('substitution.date')}</Label>
            <DatePicker
              date={dateAsDate}
              onDateChange={(d) =>
                setFormState((prev) => ({
                  ...prev,
                  date: d ? toLocalDateString(d) : '',
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
              {cohortLessonsQuery.isLoading && (
                <p className="p-2 text-muted-foreground text-sm">
                  {t('substitution.loadingLessons')}
                </p>
              )}
              {!cohortLessonsQuery.isLoading &&
                availableLessons.length === 0 && (
                  <p className="p-2 text-muted-foreground text-sm">
                    {t('substitution.noLessons')}
                  </p>
                )}
              {!cohortLessonsQuery.isLoading &&
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

          <DialogFooter>
            <Button disabled={!isValid || isSubmitting} type="submit">
              <Save className="h-4 w-4" />
              {isCreate ? t('substitution.create') : t('substitution.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
