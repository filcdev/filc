import { useQuery } from '@tanstack/react-query';
import { type InferRequestType, parseResponse } from 'hono/client';
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

type Classroom = {
  id: string;
  name: string;
  short: string;
};

type Period = {
  endTime: string;
  id: string;
  period: number;
  startTime: string;
};

type DayDefinition = {
  days: string[];
  id: string;
  name: string;
  short: string;
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

type MovedLessonItem = {
  classroom: Classroom | null;
  dayDefinition: DayDefinition | null;
  lessons: string[];
  movedLesson: {
    date: string;
    id: string;
    room: string | null;
    startingDay: string | null;
    startingPeriod: string | null;
  };
  period: Period | null;
};

const upd = api.timetable.movedLessons[':id'].$put;
type MovedLessonFormValues = InferRequestType<typeof upd>['json'] & {
  lessonIds: string[];
};

type MovedLessonDialogProps = {
  allLessons: EnrichedLesson[];
  classrooms: Classroom[];
  cohorts: Cohort[];
  days: DayDefinition[];
  isSubmitting: boolean;
  item?: MovedLessonItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: MovedLessonFormValues) => Promise<void>;
  open: boolean;
  periods: Period[];
};

function formatLessonLabel(lesson: EnrichedLesson): string {
  const parts: string[] = [];
  if (lesson.subject) {
    parts.push(lesson.subject.short);
  }
  if (lesson.day) {
    parts.push(lesson.day.short);
  }
  if (lesson.period) {
    parts.push(`P${lesson.period.period}`);
  }
  if (lesson.cohorts.length > 0) {
    parts.push(`(${lesson.cohorts.join(', ')})`);
  }
  return parts.join(' - ') || lesson.id;
}

const initialState = (
  item?: MovedLessonItem | null
): MovedLessonFormValues => ({
  date: item?.movedLesson.date ? new Date(item.movedLesson.date) : new Date(),
  lessonIds: item?.lessons ?? [],
  room: item?.movedLesson.room ?? '',
  startingDay: item?.movedLesson.startingDay ?? '',
  startingPeriod: item?.movedLesson.startingPeriod ?? '',
});

export function MovedLessonDialog({
  allLessons,
  classrooms,
  cohorts,
  days,
  isSubmitting,
  item,
  onOpenChange,
  onSubmit,
  open,
  periods,
}: MovedLessonDialogProps) {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<MovedLessonFormValues>(
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

  const mergedDays = useMemo(() => {
    const dayMap = new Map<string, DayDefinition>();
    for (const d of days) {
      dayMap.set(d.id, d);
    }
    for (const l of cohortLessonsQuery.data ?? []) {
      if (l.day) {
        dayMap.set(l.day.id, {
          days: [],
          id: l.day.id,
          name: l.day.name,
          short: l.day.short,
        });
      }
    }
    return Array.from(dayMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [days, cohortLessonsQuery.data]);

  const mergedPeriods = useMemo(() => {
    const periodMap = new Map<string, Period>();
    for (const p of periods) {
      periodMap.set(p.id, p);
    }
    for (const l of cohortLessonsQuery.data ?? []) {
      if (l.period) {
        periodMap.set(l.period.id, l.period);
      }
    }
    return Array.from(periodMap.values()).sort((a, b) => a.period - b.period);
  }, [periods, cohortLessonsQuery.data]);

  const isCreate = !item;

  const isValid = useMemo(() => {
    if (!formState.date) {
      return false;
    }
    return true;
  }, [formState.date]);

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
            {isCreate ? t('movedLesson.create') : t('movedLesson.edit')}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>{t('movedLesson.date')}</Label>
            <DatePicker
              date={dateAsDate}
              onDateChange={(d) =>
                setFormState((prev) => ({
                  ...prev,
                  date: d ? d : prev.date,
                }))
              }
              placeholder={t('movedLesson.datePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('movedLesson.targetDay')}</Label>
            <Combobox
              emptyMessage={t('movedLesson.noDayFound')}
              onValueChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  startingDay: value === '__none__' ? '' : value || '',
                }))
              }
              options={[
                {
                  label: t('movedLesson.noChange'),
                  value: '__none__',
                },
                ...mergedDays.map((day) => ({
                  label: `${day.name} (${day.short})`,
                  value: day.id,
                })),
              ]}
              placeholder={t('movedLesson.targetDay')}
              searchPlaceholder={t('search')}
              value={formState.startingDay ?? '__none__'}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('movedLesson.targetPeriod')}</Label>
            <Combobox
              emptyMessage={t('movedLesson.noPeriodFound')}
              onValueChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  startingPeriod: value === '__none__' ? '' : value || '',
                }))
              }
              options={[
                {
                  label: t('movedLesson.noChange'),
                  value: '__none__',
                },
                ...mergedPeriods.map((p) => ({
                  label: t('movedLesson.periodLabel', {
                    end: p.endTime.slice(0, 5),
                    num: p.period,
                    start: p.startTime.slice(0, 5),
                  }),
                  value: p.id,
                })),
              ]}
              placeholder={t('movedLesson.targetPeriod')}
              searchPlaceholder={t('search')}
              value={formState.startingPeriod ?? '__none__'}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('movedLesson.targetRoom')}</Label>
            <Combobox
              emptyMessage={t('movedLesson.noRoomFound')}
              onValueChange={(value) =>
                setFormState((prev) => ({
                  ...prev,
                  room: value === '__none__' ? '' : value || '',
                }))
              }
              options={[
                {
                  label: t('movedLesson.noChange'),
                  value: '__none__',
                },
                ...classrooms.map((cr) => ({
                  label: `${cr.name} (${cr.short})`,
                  value: cr.id,
                })),
              ]}
              placeholder={t('movedLesson.targetRoom')}
              searchPlaceholder={t('search')}
              value={formState.room ?? '__none__'}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('movedLesson.selectCohort')}</Label>
            <Combobox
              emptyMessage={t('movedLesson.noCohortFound')}
              onValueChange={(v) => setSelectedCohort(v)}
              options={cohorts.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
              placeholder={t('movedLesson.selectCohortPlaceholder')}
              searchPlaceholder={t('search')}
              value={selectedCohort}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('movedLesson.lessons')}</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {cohortLessonsQuery.isLoading && (
                <p className="p-2 text-muted-foreground text-sm">
                  {t('movedLesson.loadingLessons')}
                </p>
              )}
              {!cohortLessonsQuery.isLoading &&
                availableLessons.length === 0 && (
                  <p className="p-2 text-muted-foreground text-sm">
                    {t('movedLesson.noLessons')}
                  </p>
                )}
              {!cohortLessonsQuery.isLoading &&
                availableLessons.length > 0 &&
                availableLessons.map((lesson) => (
                  <label
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    htmlFor={`ml-lesson-${lesson.id}`}
                    key={lesson.id}
                  >
                    <Checkbox
                      checked={formState.lessonIds.includes(lesson.id)}
                      id={`ml-lesson-${lesson.id}`}
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
              {isCreate ? t('movedLesson.create') : t('movedLesson.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
