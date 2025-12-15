import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { FaClock, FaLocationDot, FaUser } from 'react-icons/fa6';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipPositioner,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type ClassSession = {
  id: string;
  subject: string;
  teacher: string; // may contain multiple comma-separated names
  room: string; // may contain multiple comma-separated rooms
  startTime: string;
  endTime: string;
  description?: string;
  color: string;
  short: string;
};

// Legacy structure support (day -> time -> single session)
export type TimetableData = {
  [day: string]: {
    [timeSlot: string]: ClassSession | ClassSession[] | null;
  };
};

// Metadata for sorting days correctly
export type DayMetadata = {
  [dayName: string]: {
    sortOrder: number; // Day number from day.days array
  };
};

type TimetableProps = {
  data: TimetableData;
  dayMetadata?: DayMetadata;
  className?: string;
  title?: string;
};

const getDaysFromData = (
  data: TimetableData,
  dayMetadata?: DayMetadata
): string[] => {
  const days = Object.keys(data);

  if (!dayMetadata) {
    return days;
  }

  return days.sort((a, b) => {
    const orderA = dayMetadata[a]?.sortOrder ?? 999;
    const orderB = dayMetadata[b]?.sortOrder ?? 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // If both have the same order or are unknown, sort alphabetically
    return a.localeCompare(b);
  });
};

const getTimeSlotsFromData = (data: TimetableData): string[] => {
  const set = new Set<string>();
  for (const day of Object.keys(data)) {
    const times = Object.keys(data[day] ?? {});
    for (const t of times) {
      set.add(t);
    }
  }
  return Array.from(set).sort();
};

const ClassTooltip = ({ session }: { session: ClassSession }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <div
          className="h-full w-full cursor-pointer rounded-md border p-3 transition-all hover:scale-[1.02] hover:shadow-lg"
          style={{
            backgroundColor: `${session.color}20`,
            borderColor: `${session.color}50`,
          }}
        >
          <div className="flex h-full items-center justify-between gap-1">
            <div className="truncate font-medium text-foreground text-sm leading-5">
              {session.short}
            </div>
            <div className="text-[10px] text-muted-foreground leading-5">
              {session.room}
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipPositioner side="top">
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-sm">{session.subject}</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <FaClock className="h-3 w-3" />
                <span>
                  {session.startTime} - {session.endTime}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FaUser className="h-3 w-3" />
                <span>{session.teacher}</span>
              </div>
              <div className="flex items-center gap-2">
                <FaLocationDot className="h-3 w-3" />
                <span>{session.room}</span>
              </div>
              {session.description && (
                <div className="border-border border-t pt-1">
                  <p className="text-muted-foreground">{session.description}</p>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </TooltipPositioner>
    </Tooltip>
  </TooltipProvider>
);

const ClassCell = ({
  session,
}: {
  session: ClassSession | ClassSession[] | null;
}) => {
  if (!session) {
    return <div className="h-full w-full" />;
  }
  const sessions = Array.isArray(session) ? session : [session];
  const gridWidth =
    sessions.length > 3 ? 'grid-cols-3' : `grid-cols-${sessions.length}`;

  return (
    <div className={`grid h-full w-full ${gridWidth} gap-1`}>
      {sessions.map((s) => (
        <ClassTooltip key={`${s.id}-${s.startTime}`} session={s} />
      ))}
    </div>
  );
};

export function Timetable({
  data,
  dayMetadata,
  className,
  title = 'Class Schedule',
}: TimetableProps) {
  type Row = { time: string } & Record<
    string,
    ClassSession | ClassSession[] | null
  >;

  const days = getDaysFromData(data, dayMetadata);
  const timeSlots = getTimeSlotsFromData(data);

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: 'time',
      cell: (info: { getValue: () => unknown }) => (
        <div className="font-medium font-mono text-muted-foreground text-sm">
          {String(info.getValue())}
        </div>
      ),
      header: 'Time',
      size: 80,
    },
    ...days.map((day) => ({
      accessorKey: day,
      cell: (info: { getValue: () => unknown }) => (
        <ClassCell session={info.getValue() as Row[keyof Row]} />
      ),
      header: day,
      size: 200,
    })),
  ];

  const tableData: Row[] = timeSlots.map((time) => {
    const row: Row = { time } as Row;
    for (const day of days) {
      row[day] = data[day]?.[time] ?? null;
    }
    return row;
  });

  const table = useReactTable<Row>({
    columns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="text-balance font-bold text-2xl">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  className="border-border hover:bg-transparent"
                  key={headerGroup.id}
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className="bg-muted/50 text-center font-semibold text-foreground"
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  className="border-border hover:bg-muted/30"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className="p-1 text-center"
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
