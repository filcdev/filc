import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LessonCard } from './lesson-card';
import type { ViewModel } from './types';

export function TimetableGrid({
  model,
  title,
}: {
  model: ViewModel;
  title: string;
}) {
  const { days, timeSlots, grid } = model;

  return (
    <Card className="w-full shadow-2xl print:shadow-none">
      <CardHeader className="print:hidden">
        <CardTitle className="text-balance font-bold text-2xl">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border bg-card print:border-0">
          <Table className="print:text-black">
            <TableHeader className="print:table-header-group">
              <TableRow className="border-border bg-muted/50 print:bg-white">
                <TableHead className="w-24 text-left font-semibold">
                  Time
                </TableHead>
                {days.map((day) => (
                  <TableHead
                    className="text-center font-semibold"
                    key={day.name}
                  >
                    {day.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeSlots.map((time) => (
                <TableRow className="border-border align-top" key={time}>
                  <TableCell className="w-24 whitespace-nowrap font-mono text-muted-foreground text-sm print:text-black">
                    {time}
                  </TableCell>
                  {days.map((day) => {
                    const cell = grid[time]?.[day.name];
                    if (!cell || cell.type === 'skip') {
                      return null;
                    }
                    if (cell.type === 'empty') {
                      return <TableCell key={`${time}-${day.name}`} />;
                    }

                    const lessons = cell.block.lessons;
                    const multi = lessons.length > 1;
                    const isMultiRow = cell.block.rowSpan > 1;

                    return (
                      <TableCell
                        className="relative min-w-52 p-0"
                        key={cell.block.key}
                        rowSpan={cell.block.rowSpan}
                      >
                        <div
                          className={clsx('gap-2 p-1', {
                            'absolute inset-0': isMultiRow,
                            'absolute inset-0 overflow-auto':
                              isMultiRow && multi,
                            'flex flex-col': !multi,
                            grid: multi,
                          })}
                          style={
                            multi
                              ? {
                                  gridTemplateColumns: `repeat(${lessons.length}, minmax(0, 1fr))`,
                                }
                              : undefined
                          }
                        >
                          {lessons.map((lesson) => (
                            <LessonCard key={lesson.id} lesson={lesson} />
                          ))}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
