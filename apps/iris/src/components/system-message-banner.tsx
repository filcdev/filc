import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { authClient } from '@/utils/authentication';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type SystemMessageApiResponse = InferResponseType<
  (typeof api.news)['system-messages']['$get']
>;
type SystemMessageItem = NonNullable<SystemMessageApiResponse['data']>[number];

type BlockContent = {
  content: string;
  type: string;
};

const DISMISSED_STORAGE_KEY = 'filc.system-messages.dismissed.v1';

const parseDismissedIds = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
};

const readDismissedIds = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  return parseDismissedIds(window.localStorage.getItem(DISMISSED_STORAGE_KEY));
};

const writeDismissedIds = (ids: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(ids));
};

const renderBlockContent = (content: unknown): string => {
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
};

export function SystemMessageBanner() {
  const { isPending } = authClient.useSession();
  const { i18n, t } = useTranslation();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setDismissedIds(readDismissedIds());
  }, []);

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
    queryKey: queryKeys.news.systemMessagesBanner(),
  });

  const visibleMessages = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    const items = systemMessagesQuery.data ?? [];
    return items.filter((item) => !dismissed.has(item.id));
  }, [dismissedIds, systemMessagesQuery.data]);

  useEffect(() => {
    const idsInFeed = new Set(
      (systemMessagesQuery.data ?? []).map((item) => item.id)
    );
    const nextDismissed = dismissedIds.filter((id) => idsInFeed.has(id));

    if (nextDismissed.length !== dismissedIds.length) {
      setDismissedIds(nextDismissed);
      writeDismissedIds(nextDismissed);
    }
  }, [dismissedIds, systemMessagesQuery.data]);

  const dismissMessage = (messageId: string) => {
    setDismissedIds((previous) => {
      if (previous.includes(messageId)) {
        return previous;
      }

      const next = [...previous, messageId];
      writeDismissedIds(next);
      return next;
    });
  };

  if (systemMessagesQuery.isLoading || visibleMessages.length === 0) {
    return null;
  }

  const message = visibleMessages[0];
  if (!message) {
    return null;
  }

  const from = formatLocalizedDate(message.validFrom, i18n.language);
  const until = formatLocalizedDate(message.validUntil, i18n.language);

  return (
    <div className="fixed inset-x-0 top-0 z-70">
      <div className="flex items-center bg-destructive text-destructive-foreground shadow-md">
        <div className="min-w-0 flex-1 px-3 py-2 sm:px-4">
          <p className="font-semibold text-sm leading-5">{message.title}</p>
          <p className="wrap-break-word mt-0.5 text-xs leading-5 opacity-95">
            {renderBlockContent(message.content)}
          </p>
          <p className="mt-0.5 text-[11px] opacity-80">
            {from === until ? from : `${from} - ${until}`}
          </p>
        </div>
        <Button
          aria-label={t('systemMessagesBanner.dismiss')}
          className="shrink-0 text-destructive-foreground hover:bg-destructive-foreground/15 hover:text-destructive-foreground"
          onClick={() => dismissMessage(message.id)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
