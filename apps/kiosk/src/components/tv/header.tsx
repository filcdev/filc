import { Tv } from 'lucide-react';
import { Marquee } from '@/components/tv/marquee';
import { Loading, QueryError } from '@/components/tv/query-states';
import { TV_STRINGS } from '@/components/tv/strings';
import { type NewsTakeoverPolicy, useFeaturedNews } from '@/hooks/tv';
import { useClock } from '@/hooks/use-clock';
import { APP_VERSION } from '@/utils/version';

type HeaderProps = {
  /** The box's takeover policy: featured news is not repeated in the ticker. */
  newsPolicy: NewsTakeoverPolicy;
};

/** Ticker header: brand, announcement marquee and the wall clock. */
export function Header({ newsPolicy }: HeaderProps) {
  const [dateText, timeText] = useClock();

  return (
    <>
      <div>
        <span className="flex items-center gap-1 font-bold text-lg">
          <Tv className="size-6" />
          <span>
            {TV_STRINGS.header.brand}
            <span className="font-light text-sm">{APP_VERSION}</span>
          </span>
        </span>
      </div>
      <div className="flex max-w-md items-center">
        <News policy={newsPolicy} />
      </div>
      <div className="flex items-center gap-2">
        <span>{dateText}</span>
        <span className="font-bold">{timeText}</span>
      </div>
    </>
  );
}

/** Announcement titles, scrolling slowly enough to be readable. */
function News({ policy }: { policy: NewsTakeoverPolicy }) {
  const { headlines, isError, isLoading } = useFeaturedNews(policy);

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <QueryError />;
  }

  if (!headlines) {
    return null;
  }

  return <Marquee className="px-2 py-0.5" text={headlines} />;
}
