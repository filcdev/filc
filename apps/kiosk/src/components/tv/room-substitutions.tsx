import {
  ArrowRightFromLine,
  ArrowRightToLine,
  Clock,
  School,
} from 'lucide-react';
import { AnimatedPlaceholder } from '@/components/tv/animated-placeholder';
import { Loading, QueryError } from '@/components/tv/query-states';
import { TV_STRINGS } from '@/components/tv/strings';
import { useRoomChanges } from '@/hooks/tv';
import { usePageCycler } from '@/hooks/use-page-cycler';
import { TABLE } from '@/utils/constants';

/** Today's room changes, cycled a page at a time. */
export function RoomSubstitution() {
  const { isError, isLoading, rows } = useRoomChanges();

  const pageSize = TABLE.roomSubstitutions.pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageIndex = usePageCycler({
    cycleInterval: TABLE.cycleInterval,
    totalPages,
  });

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return <QueryError />;
  }

  if (rows.length === 0) {
    return <AnimatedPlaceholder title={TV_STRINGS.roomChanges.empty} />;
  }

  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className="flex h-full max-h-full max-w-full flex-col rounded-lg">
      <div className="grow">
        <table className="h-full w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="w-12 border-border p-2 text-center font-semibold">
                <div className="flex items-center justify-center gap-1 text-nowrap">
                  <Clock className="size-4" />
                </div>
              </th>
              <th className="border-border border-l p-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1 text-nowrap">
                  <ArrowRightFromLine className="size-4" />
                  {TV_STRINGS.table.from}
                </div>
              </th>
              <th className="border-border border-l p-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1 text-nowrap">
                  <ArrowRightToLine className="size-4" />
                  {TV_STRINGS.table.to}
                </div>
              </th>
              <th className="border-border border-l p-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1 text-nowrap">
                  <School className="size-4" />
                  {TV_STRINGS.table.class}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr
                className={`h-8 border-border border-b last:border-border/80 ${index % 2 === 0 ? 'bg-background/20' : 'bg-transparent'}`}
                key={`${row.lesson}-${row.class}-${row.from}-${row.to}`}
              >
                <td className="border-border py-1 text-center [&:not(:first-child)]:border-l">
                  {row.lesson}
                </td>
                <td className="border-border py-1 text-center [&:not(:first-child)]:border-l">
                  {row.from}
                </td>
                <td className="border-border py-1 text-center [&:not(:first-child)]:border-l">
                  {row.to}
                </td>
                <td className="border-border py-1 text-center [&:not(:first-child)]:border-l">
                  {row.class}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-2">
        <span>
          {TV_STRINGS.roomChanges.total} {rows.length}
        </span>
        {totalPages > 1 && (
          <span className="font-bold">
            {pageIndex + 1}/{totalPages}
          </span>
        )}
      </div>
    </div>
  );
}
