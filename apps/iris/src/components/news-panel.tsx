import { useSession } from '@filcdev/auth/client';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type AnnouncementItem, useAnnouncementsPanel } from '@/hooks/news';
import {
  formatLocalizedDate,
  parseDateOnly,
} from '@/utils/date-locale';

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

    const validFrom = parseDateOnly(announcement.validFrom);
    const validUntil = parseDateOnly(announcement.validUntil);
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
  const { i18n } = useTranslation();

  const announcementsQuery = useAnnouncementsPanel(!isPending);
  const todayKey = toDateKey(new Date());

  const newsDays = useMemo(
    () =>
      getNewsDates(
        announcementsQuery.data,
        classId,
        parseDateOnly(todayKey)
      ),
    [announcementsQuery.data, classId, todayKey]
  );

  const isLoading =
    announcementsQuery.isLoading ||
    announcementsQuery.isFetching ||
    announcementsQuery.isFetching;

  return (
    <div className="space-y-3">
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
                        item.validFrom,
                        i18n.language
                      );
                      const until = formatLocalizedDate(
                        item.validUntil,
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
