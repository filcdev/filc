import { TableHead, TableHeader, TableRow } from '@filcdev/ui/components/table';

type TableHeaderRowColumn = {
  /** Extra classes for this head, e.g. the width of an actions column. */
  className?: string;
  key: string;
  label: string;
};

type TableHeaderRowProps = {
  columns: TableHeaderRowColumn[];
};

/** Header of a hand-rolled table: one head per column label. */
export function TableHeaderRow({ columns }: TableHeaderRowProps) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((column) => (
          <TableHead className={column.className} key={column.key}>
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
