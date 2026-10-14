import { Clock, MapPin, School, User, Users } from 'lucide-react';
import { AnimatedPlaceholder } from '@/components/tv/animated-placeholder';
import { Loading, QueryError } from '@/components/tv/query-states';
import { TV_STRINGS } from '@/components/tv/strings';
import { useTvSubstitutions } from '@/hooks/tv';
import { usePageCycler } from '@/hooks/use-page-cycler';
import { TABLE } from '@/utils/constants';

/** Today's substitutions, cycled a page at a time. */
export function Substitutions() {
  const { data, isError, isLoading, rows } = useTvSubstitutions();

  const pageSize = TABLE.substitutions.pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageIndex = usePageCycler({
    cycleInterval: TABLE.cycleInterval,
    totalPages,
  });

  // Guard on `data`, not `isError`: React Query keeps the last successful
  // `data` after a background refetch fails (it only flips `isError`), so a
  // transient network blip would otherwise swap the whole board for the error
  // state and blank the header until the next success. Fall through to the
  // table so the retained rows keep rendering.
  if (data === undefined && isLoading) {
    return <Loading />;
  }

  if (data === undefined && isError) {
    return <QueryError />;
  }

  if (rows.length === 0) {
    return <AnimatedPlaceholder title={TV_STRINGS.substitutions.empty} />;
  }

  const pageRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  return (
    <div className="flex h-full max-h-full max-w-full flex-col rounded-lg">
      <div className="min-h-0 grow overflow-hidden">
        <table className="h-full w-full">
          <thead>
            <tr className="border-border border-b">
              <th className="w-12 border-border px-4 py-2 text-center font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="size-4" />
                </div>
              </th>
              <th className="border-border border-l px-4 py-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <User className="size-4" />
                  {TV_STRINGS.table.teacher}
                </div>
              </th>
              <th className="border-border border-l px-4 py-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <Users className="size-4" />
                  {TV_STRINGS.table.missing}
                </div>
              </th>
              <th className="border-border border-l px-4 py-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <School className="size-4" />
                  {TV_STRINGS.table.class}
                </div>
              </th>
              <th className="border-border border-l px-4 py-2 text-left font-semibold">
                <div className="flex items-center justify-center gap-1">
                  <MapPin className="size-4" />
                  {TV_STRINGS.table.classroom}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => (
              <tr
                className={`h-12 border-border border-b last:border-border/80 ${index % 2 === 0 ? 'bg-background/20' : 'bg-transparent'}`}
                key={row.id}
              >
                <td className="border-border py-2 text-center [&:not(:first-child)]:border-l">
                  {row.lesson}
                </td>
                <td className="border-border py-2 text-center [&:not(:first-child)]:border-l">
                  {/* A cancelled row has no substituter, so show the lesson's original teacher instead. */}
                  {row.cancelled ? row.missing : row.teacher}
                </td>
                <td className="border-border py-2 text-center [&:not(:first-child)]:border-l">
                  {row.cancelled
                    ? TV_STRINGS.substitutions.cancelled
                    : row.missing}
                </td>
                <td className="border-border py-2 text-center [&:not(:first-child)]:border-l">
                  {row.className}
                </td>
                <td className="border-border py-2 text-center [&:not(:first-child)]:border-l">
                  {row.classroom}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-2">
        <span>
          {TV_STRINGS.substitutions.total} {rows.length}
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
