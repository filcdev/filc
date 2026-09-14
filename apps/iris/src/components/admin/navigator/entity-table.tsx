import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { Pen, Trash } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type EntityTableColumn<T> = {
  className?: string;
  header: string;
  key: string;
  render: (row: T) => ReactNode;
};

type EntityTableProps<T> = {
  columns: EntityTableColumn<T>[];
  /** Override the delete confirmation body; defaults to the navigator one. */
  deleteConfirmDescription?: (row: T) => string;
  /** Override the delete confirmation title; defaults to the navigator one. */
  deleteConfirmTitle?: string;
  /** Human-readable row label used in the delete confirmation. */
  getRowLabel: (row: T) => string;
  getRowId: (row: T) => string;
  onDelete: (row: T) => void;
  onEdit: (row: T) => void;
  onHover?: (row: T | null) => void;
  rows: T[];
};

/**
 * Shared list table for the navigator entity pages: one row per entity with
 * edit/delete actions, a delete confirmation, and an optional hover callback
 * that highlights the hovered entity in the canvas.
 */
export function EntityTable<T>({
  columns,
  deleteConfirmDescription,
  deleteConfirmTitle,
  getRowId,
  getRowLabel,
  onDelete,
  onEdit,
  onHover,
  rows,
}: EntityTableProps<T>) {
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead className={column.className} key={column.key}>
                  {column.header}
                </TableHead>
              ))}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={getRowId(row)}
                onMouseEnter={() => onHover?.(row)}
                onMouseLeave={() => onHover?.(null)}
              >
                {columns.map((column) => (
                  <TableCell className={column.className} key={column.key}>
                    {column.render(row)}
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      aria-label={t('common.edit')}
                      onClick={() => onEdit(row)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Pen className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={t('common.delete')}
                      onClick={() => setPendingDelete(row)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={columns.length + 1}
                >
                  {t('ui.common.no_data')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        open={pendingDelete !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteConfirmTitle ?? t('navigator.deleteConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? (deleteConfirmDescription?.(pendingDelete) ??
                  t('navigator.deleteConfirmDescription', {
                    name: getRowLabel(pendingDelete),
                  }))
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setPendingDelete(null)}
              type="button"
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (pendingDelete) {
                  onDelete(pendingDelete);
                }
                setPendingDelete(null);
              }}
              type="button"
              variant="destructive"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
