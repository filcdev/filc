import { useSession } from '@filcdev/auth/client';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
import { Button } from '@filcdev/ui/components/button';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { CalendarDays, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterCombobox } from '@/components/timetable/filter-combobox';
import { type AnnouncementItem, useAnnouncementsPanel } from '@/hooks/news';
import {
  useLatestValidTimetable,
  useTimetableCohorts,
  useTimetables,
} from '@/hooks/timetable-public';
import { formatLocalizedDate, parseDateOnly } from '@/utils/date-locale';

type BlockContent = {
  content: string;
  type: string;
};

type NewsItem = {
  id: string;
  title: string;
  content: unknown;
  validFrom: Date;
  validUntil: Date;
  type: 'announcement';
};

function renderBlockContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((block: BlockContent) => block.content)
      .filter(Boolean)
      .join(' ');
  }

  return '';
}

function getNewsDates(
  announcements: AnnouncementItem[] | undefined,
  classId: string | null | undefined,
  today: Date
): { date: string; items: NewsItem[] }[] {
  const grouped = new Map<string, NewsItem[]>();

  for (const announcement of announcements ?? []) {
    if (
      classId &&
      announcement.cohortIds.length > 0 &&
      !announcement.cohortIds.includes(classId)
    ) {
      continue;
    }

    const validFrom = parseDateOnly(new Date(announcement.validFrom));
    const validUntil = parseDateOnly(new Date(announcement.validUntil));
    if (validUntil < today) {
      continue;
    }

    const date = toDateKey(validFrom < today ? today : validFrom);
    const items = grouped.get(date) ?? [];
    items.push({
      content: announcement.content,
      id: announcement.id,
      title: announcement.title ?? 'Untitled',
      type: 'announcement',
      validFrom: announcement.validFrom,
      validUntil: announcement.validUntil,
    });
    grouped.set(date, items);
  }

  return Array.from(grouped, ([date, items]) => ({
    date,
    items: items.sort(
      (a, b) =>
        new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
    ),
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function NewsPanel({
  classId,
  emptyMessage,
}: {
  classId?: string | null;
  emptyMessage?: string;
}) {
  const { isPending } = useSession();
  const { i18n, t } = useTranslation();

  const announcementsQuery = useAnnouncementsPanel(!isPending);
  const timetablesQuery = useTimetables();
  const latestTimetableQuery = useLatestValidTimetable();
  const timetableId =
    latestTimetableQuery.data?.id ?? timetablesQuery.data?.[0]?.id ?? null;
  const cohortsQuery = useTimetableCohorts(timetableId);
  const cohorts = cohortsQuery.data ?? [];
  const [selectedClassId, setSelectedClassId] = useState<
    string | null | undefined
  >(undefined);
  const [filterOpen, setFilterOpen] = useState(false);
  const defaultClassId =
    cohorts.find((cohort) => cohort.id === classId)?.id ?? null;
  const activeClassId =
    selectedClassId === undefined ? defaultClassId : selectedClassId;
  const cohortOptions = useMemo(
    () => cohorts.map((cohort) => ({ label: cohort.name, value: cohort.id })),
    [cohorts]
  );
  const isClassFilterLoading =
    timetablesQuery.isLoading ||
    latestTimetableQuery.isLoading ||
    (!!timetableId && cohortsQuery.isLoading);
  const todayKey = toDateKey(new Date());

  const newsDays = useMemo(
    () =>
      getNewsDates(
        announcementsQuery.data,
        activeClassId,
        parseDateOnly(todayKey)
      ),
    [announcementsQuery.data, activeClassId, todayKey]
  );

  const isLoading =
    announcementsQuery.isLoading ||
    announcementsQuery.isFetching ||
    isClassFilterLoading;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {isClassFilterLoading ? (
          <Skeleton className="h-9 w-36 sm:w-44" />
        ) : (
          <FilterCombobox
            className="w-36 sm:w-44"
            emptyMessage={t('timetable.noClassFound')}
            id="news-class-filter"
            onOpenChange={setFilterOpen}
            onSelect={(value) => {
              setSelectedClassId(value);
              setFilterOpen(false);
            }}
            open={filterOpen}
            options={cohortOptions}
            placeholder={t('timetable.selectClass')}
            searchPlaceholder={t('timetable.searchClass')}
            selectedValue={activeClassId ?? ''}
            size="sm"
          />
        )}
        {activeClassId && !isClassFilterLoading && (
          <Button
            aria-label={t('timetable.clearFilter')}
            className="h-9 w-9 p-0"
            onClick={() => setSelectedClassId(null)}
            size="sm"
            variant="ghost"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}
      {!isLoading &&
        newsDays.map(({ date, items }) => (
          <section className="space-y-3" key={date}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarDays className="h-5 w-5" />
              </div>
              <h2 className="font-semibold text-foreground text-lg">
                {formatLocalizedDate(parseDateOnly(date), i18n.language, {
                  day: '2-digit',
                  month: 'long',
                  weekday: 'long',
                  year: 'numeric',
                })}
              </h2>
            </div>
            <div className="grid gap-3">
              {items.map((item) => (
                <Alert key={item.id}>
                  <AlertTitle className="font-semibold" translate="yes">
                    {item.title}
                  </AlertTitle>
                  <AlertDescription
                    className="mt-2 whitespace-pre-wrap"
                    translate="yes"
                  >
                    {renderBlockContent(item.content)}
                  </AlertDescription>
                  <div className="mt-2 text-muted-foreground text-xs">
                    {(() => {
                      const from = formatLocalizedDate(
                        parseDateOnly(new Date(item.validFrom)),
                        i18n.language
                      );
                      const until = formatLocalizedDate(
                        parseDateOnly(new Date(item.validUntil)),
                        i18n.language
                      );
                      return from === until ? from : `${from} – ${until}`;
                    })()}
                  </div>
                </Alert>
              ))}
            </div>
          </section>
        ))}
      {!isLoading && newsDays.length === 0 && emptyMessage && (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
