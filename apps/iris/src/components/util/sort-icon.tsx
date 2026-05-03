import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

type SortIconProps<T extends string> = {
  column: T;
  currentColumn: T | null;
  direction: 'asc' | 'desc' | null;
};

export function SortIcon<T extends string>({
  column,
  currentColumn,
  direction,
}: SortIconProps<T>) {
  if (currentColumn !== column) {
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="h-4 w-4" />
  ) : (
    <ArrowDown className="h-4 w-4" />
  );
}
