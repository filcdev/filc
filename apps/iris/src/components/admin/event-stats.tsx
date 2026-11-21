import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@filcdev/ui/components/chart';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import type { EventStatsData } from '@/hooks/events';

/** One colour per slice, in the theme's chart palette. */
const SLICE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const;

const sliceColor = (index: number): string =>
  SLICE_COLORS[index % SLICE_COLORS.length] ?? SLICE_COLORS[0];

type Slice = { label: string; value: number };

/**
 * A donut with a text legend underneath. The legend carries every slice and its
 * number, so the panel reads without relying on colour alone.
 */
function PiePanel({
  description,
  emptyLabel,
  slices,
  title,
}: {
  description?: string;
  emptyLabel?: string;
  slices: Slice[];
  title: string;
}) {
  const { t } = useTranslation();
  const shown = slices.filter((slice) => slice.value > 0);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  const config: ChartConfig = Object.fromEntries(
    slices.map((slice, index) => [
      String(index),
      { color: sliceColor(index), label: slice.label },
    ])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">
            {emptyLabel ?? t('events.participants.stats.noAnswers')}
          </p>
        ) : (
          <>
            <ChartContainer className="mx-auto h-52 w-full" config={config}>
              <PieChart>
                <Pie
                  data={shown}
                  dataKey="value"
                  innerRadius={45}
                  nameKey="label"
                  strokeWidth={2}
                >
                  {shown.map((slice) => (
                    <Cell
                      fill={sliceColor(slices.indexOf(slice))}
                      key={slice.label}
                    />
                  ))}
                </Pie>
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  cursor={false}
                />
              </PieChart>
            </ChartContainer>
            <ul className="space-y-1 text-sm">
              {slices.map((slice, index) => (
                <li
                  className="flex items-center justify-between gap-3"
                  key={slice.label}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: sliceColor(index) }}
                    />
                    <span className="truncate">{slice.label}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {slice.value}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NumberTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}

/**
 * The organizer's statistics panel: seats, role and status pies, the answers of
 * each question and the registration timeline. It is rendered through
 * `components/lazy` from the page, which is why recharts lives in this module
 * and not in the route's chunk.
 */
export default function EventStatsPanel({ stats }: { stats: EventStatsData }) {
  const { t } = useTranslation();

  const registrations =
    stats.byStatus.confirmed +
    stats.byStatus.pending +
    stats.byStatus.cancelled;
  const unlimited = t('events.unlimited');

  const perDayConfig: ChartConfig = {
    count: {
      color: 'var(--chart-1)',
      label: t('events.participants.stats.perDay'),
    },
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberTile
          label={t('events.participants.stats.capacity')}
          value={stats.seats.capacity ?? unlimited}
        />
        <NumberTile
          label={t('events.participants.stats.taken')}
          value={stats.seats.taken}
        />
        <NumberTile
          label={t('events.participants.stats.remaining')}
          value={stats.seats.remaining ?? unlimited}
        />
        <NumberTile
          label={t('events.participants.stats.checkedIn')}
          value={stats.checkedIn}
        />
      </div>

      {registrations === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">
              {t('events.participants.stats.empty')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <PiePanel
              slices={[
                {
                  label: t('events.participants.roles.participant'),
                  value: stats.byRole.participant,
                },
                {
                  label: t('events.participants.roles.helper'),
                  value: stats.byRole.helper,
                },
                {
                  label: t('events.participants.roles.visitor'),
                  value: stats.byRole.visitor,
                },
              ]}
              title={t('events.participants.stats.byRole')}
            />
            <PiePanel
              slices={[
                {
                  label: t('events.participants.statuses.confirmed'),
                  value: stats.byStatus.confirmed,
                },
                {
                  label: t('events.participants.statuses.pending'),
                  value: stats.byStatus.pending,
                },
                {
                  label: t('events.participants.statuses.cancelled'),
                  value: stats.byStatus.cancelled,
                },
              ]}
              title={t('events.participants.stats.byStatus')}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('events.participants.stats.perDay')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.perDay.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {t('events.participants.stats.noAnswers')}
                </p>
              ) : (
                <ChartContainer className="h-56 w-full" config={perDayConfig}>
                  <BarChart data={stats.perDay} margin={{ bottom: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="date"
                      tickLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      tickMargin={8}
                      width={32}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {stats.answers.map((answer) =>
            answer.type === 'select' ? (
              <PiePanel
                description={t('events.participants.stats.answers', {
                  count: answer.answered,
                })}
                key={answer.fieldId}
                slices={(answer.options ?? []).map((option) => ({
                  label: option.value,
                  value: option.count,
                }))}
                title={answer.label}
              />
            ) : (
              <NumberTile
                key={answer.fieldId}
                label={answer.label}
                value={t('events.participants.stats.answers', {
                  count: answer.answered,
                })}
              />
            )
          )}
        </>
      )}
    </div>
  );
}
