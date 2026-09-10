import type { InferResponseType } from 'hono/client';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCohorts } from '@/hooks/news';
import { useApiQuery } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type AnnouncementApiResponse = InferResponseType<
  typeof api.news.announcements.$get
>;
type AnnouncementItem = NonNullable<AnnouncementApiResponse['data']>[number];

type BlockContent = {
  content: string;
  type: string;
};

type NewsItem = {
  id: string;
  title: string;
  content: unknown;
  validFrom: string;
  validUntil: string;
  type: 'announcement';
};

/** Sentinel value for the "show everything" option in the class selector. */
const EVERYONE = 'everyone';

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

function filterNewsItemsInDateRange(
  announcements: AnnouncementItem[] | undefined,
  today: Date,
  endDate: Date
): NewsItem[] {
  const items: NewsItem[] = [];

  // Add announcements
  if (announcements) {
    for (const announcement of announcements) {
      const validFrom = new Date(announcement.validFrom);
      const validUntil = new Date(announcement.validUntil);

      if (validFrom <= endDate && validUntil >= today) {
        items.push({
          content: announcement.content,
          id: announcement.id,
          title: announcement.title ?? 'Untitled',
          type: 'announcement',
          validFrom: announcement.validFrom,
          validUntil: announcement.validUntil,
        });
      }
    }
  }

  return items.sort(
    (a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
  );
}

export function NewsPanel() {
  const { data: session, isPending } = authClient.useSession();
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);
  const [classFilter, setClassFilter] = useState<string | null>(null);

  const userCohortId = session?.user?.cohortId ?? null;
  const selected = classFilter ?? userCohortId ?? EVERYONE;

  const cohortsQuery = useCohorts(true);

  const announcementsQuery = useApiQuery<AnnouncementItem[]>(
    () => api.news.announcements.$get({ query: { includeAll: 'true' } }),
    {
      enabled: !isPending,
      queryKey: queryKeys.news.announcementsPanel(),
    }
  );

  const newsItems = useMemo<NewsItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourteenDaysLater = new Date(today);
    fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14);

    const inScope =
      selected === EVERYONE
        ? announcementsQuery.data
        : (announcementsQuery.data ?? []).filter(
            (announcement) =>
              announcement.cohortIds.length === 0 ||
              announcement.cohortIds.includes(selected)
          );

    return filterNewsItemsInDateRange(inScope, today, fourteenDaysLater);
  }, [announcementsQuery.data, selected]);

  const cohortItems = [
    { label: t('news.everyone'), value: EVERYONE },
    ...(cohortsQuery.data ?? []).map((cohort) => ({
      label: cohort.name,
      value: cohort.id,
    })),
  ];

  const isLoading =
    announcementsQuery.isLoading ||
    announcementsQuery.isFetching ||
    announcementsQuery.isFetching;

  // Don't render if no news items and not loading
  if (!isLoading && newsItems.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl">
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <div className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">
                {t('news.title', 'Hírek')}
              </h2>
              {!isLoading && newsItems.length > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground text-xs">
                  {newsItems.length}
                </span>
              )}
            </div>
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t p-4">
              <div className="mb-3 flex justify-end">
                <Select
                  items={cohortItems}
                  onValueChange={setClassFilter}
                  value={selected}
                >
                  <SelectTrigger className="w-44" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                </Select>
              </div>
              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}
              {!isLoading && newsItems.length > 0 && (
                <div className="space-y-3">
                  {newsItems.map((item) => (
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
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
