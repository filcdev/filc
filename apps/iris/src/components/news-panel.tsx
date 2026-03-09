import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';

type AnnouncementApiResponse = InferResponseType<
  typeof api.news.announcements.$get
>;
type AnnouncementItem = NonNullable<AnnouncementApiResponse['data']>[number];

type SystemMessageApiResponse = InferResponseType<
  (typeof api.news)['system-messages']['$get']
>;
type SystemMessageItem = NonNullable<SystemMessageApiResponse['data']>[number];

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
  type: 'announcement' | 'system';
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

function filterNewsItemsInDateRange(
  announcements: AnnouncementItem[] | undefined,
  systemMessages: SystemMessageItem[] | undefined,
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
          title: announcement.title,
          type: 'announcement',
          validFrom: announcement.validFrom,
          validUntil: announcement.validUntil,
        });
      }
    }
  }

  // Add system messages
  if (systemMessages) {
    for (const message of systemMessages) {
      const validFrom = new Date(message.validFrom);
      const validUntil = new Date(message.validUntil);

      if (validFrom <= endDate && validUntil >= today) {
        items.push({
          content: message.content,
          id: message.id,
          title: message.title,
          type: 'system',
          validFrom: message.validFrom,
          validUntil: message.validUntil,
        });
      }
    }
  }

  return items.sort(
    (a, b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
  );
}

export function NewsPanel() {
  const { isPending } = authClient.useSession();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(true);

  const announcementsQuery = useQuery({
    enabled: !isPending,
    queryFn: async () => {
      const res = await parseResponse(
        api.news.announcements.$get({
          query: {},
        })
      );
      if (!res.success) {
        throw new Error('Failed to load announcements');
      }
      return res.data as AnnouncementItem[];
    },
    queryKey: ['announcements-panel'],
  });

  const systemMessagesQuery = useQuery({
    enabled: !isPending,
    queryFn: async () => {
      const res = await parseResponse(
        api.news['system-messages'].$get({
          query: {},
        })
      );
      if (!res.success) {
        throw new Error('Failed to load system messages');
      }
      return res.data as SystemMessageItem[];
    },
    queryKey: ['system-messages-panel'],
  });

  const newsItems = useMemo<NewsItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fourteenDaysLater = new Date(today);
    fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14);

    return filterNewsItemsInDateRange(
      announcementsQuery.data,
      systemMessagesQuery.data,
      today,
      fourteenDaysLater
    );
  }, [announcementsQuery.data, systemMessagesQuery.data]);

  const isLoading =
    announcementsQuery.isLoading ||
    systemMessagesQuery.isLoading ||
    announcementsQuery.isFetching ||
    systemMessagesQuery.isFetching;

  // Don't render if no news items and not loading
  if (!isLoading && newsItems.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl">
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <div className="rounded-lg border bg-card">
          <CollapsibleTrigger
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/50"
            onClick={() => setIsOpen(!isOpen)}
          >
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
              {isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              )}
              {!isLoading && newsItems.length > 0 && (
                <div className="space-y-3">
                  {newsItems.map((item) => (
                    <Alert
                      key={item.id}
                      variant={
                        item.type === 'system' ? 'destructive' : 'default'
                      }
                    >
                      <AlertTitle className="font-semibold">
                        {item.title}
                      </AlertTitle>
                      <AlertDescription className="mt-2 whitespace-pre-wrap">
                        {renderBlockContent(item.content)}
                      </AlertDescription>
                      <div className="mt-2 text-muted-foreground text-xs">
                        {new Date(item.validFrom).toLocaleDateString()} -{' '}
                        {new Date(item.validUntil).toLocaleDateString()}
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
