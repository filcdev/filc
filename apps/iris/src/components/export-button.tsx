import { Button } from '@filcdev/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@filcdev/ui/components/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type ExportColumn = {
  /** Header text, already localized by the consumer. */
  header: string;
  key: string;
};

type ExportButtonProps = {
  /** i18n key for the button label (defaults to `export`). */
  labelKey?: string;
  /** Hide the label below the `sm` breakpoint (icon-only on mobile). */
  hideLabelOnMobile?: boolean;
  /** i18n key for the success toast. */
  successKey: string;
  /** i18n key for the error toast. */
  errorKey: string;
  /** Prefix used for the downloaded file names. */
  filenamePrefix: string;
  /** Title shown at the top of the generated PDF. */
  pdfTitle: string;
  /** Localized description of the exported range (PDF subtitle, heading row). */
  rangeLabel: string;
  /** Columns to render in the PDF and spreadsheet tables. */
  columns: ExportColumn[];
  /** Fetches the raw CSV text from the backend. */
  fetchCsv: () => Promise<string>;
};

/**
 * Read one CSV field starting at `start`, returning its decoded value and the
 * offset just past it. A quoted field may contain commas, newlines and `""`
 * escapes; an unquoted one stops at the next delimiter.
 */
function readCsvField(
  text: string,
  start: number
): { next: number; value: string } {
  if (text[start] !== '"') {
    let end = start;
    while (
      end < text.length &&
      text[end] !== ',' &&
      text[end] !== '\n' &&
      text[end] !== '\r'
    ) {
      end += 1;
    }
    return { next: end, value: text.slice(start, end) };
  }

  let value = '';
  let index = start + 1;
  while (index < text.length) {
    if (text[index] !== '"') {
      value += text[index];
      index += 1;
      continue;
    }
    if (text[index + 1] === '"') {
      value += '"';
      index += 2;
      continue;
    }
    // Closing quote. An unterminated field simply ends with the text.
    return { next: index + 1, value };
  }
  return { next: index, value };
}

/**
 * Parse RFC 4180 CSV, including quoted fields with embedded commas, quotes and
 * newlines. The substitution export puts `'; '`-joined subject and cohort lists
 * and free-text comments in single fields, so a naive `split(',')` would both
 * split those values and misalign every following column.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    const { next, value } = readCsvField(text, offset);
    row.push(value);
    offset = next;

    if (text[offset] === ',') {
      offset += 1;
      continue;
    }

    // A CRLF pair is one record separator, not two.
    while (text[offset] === '\n' || text[offset] === '\r') {
      offset += 1;
    }
    rows.push(row);
    row = [];
  }

  if (row.length > 0) {
    rows.push(row);
  }

  const [header, ...body] = rows.filter((values) =>
    values.some((value) => value !== '')
  );
  if (!header) {
    return [];
  }

  return body.map((values) => {
    const record: Record<string, string> = {};
    for (const [index, key] of header.entries()) {
      record[key] = values[index] ?? '';
    }
    return record;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportFilename(prefix: string, extension: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function ExportButton({
  columns,
  errorKey,
  fetchCsv,
  filenamePrefix,
  hideLabelOnMobile = false,
  labelKey = 'export',
  pdfTitle,
  rangeLabel,
  successKey,
}: ExportButtonProps) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const handleCsv = async () => {
    setExporting(true);
    try {
      const text = await fetchCsv();
      downloadBlob(
        new Blob([text], { type: 'text/csv;charset=utf-8' }),
        exportFilename(filenamePrefix, 'csv')
      );
      toast.success(t(successKey));
    } catch {
      toast.error(t(errorKey));
    } finally {
      setExporting(false);
    }
  };

  const handleXlsx = async () => {
    setExporting(true);
    try {
      // Deliberately dynamic: keeps the spreadsheet writer out of the entry
      // chunk until the user actually requests an export.
      const { default: writeXlsxFile } = await import(
        'write-excel-file/browser'
      );
      const text = await fetchCsv();
      const rows = parseCsv(text);

      const worksheet = [
        columns.map((col) => ({
          fontWeight: 'bold' as const,
          value: col.header,
        })),
        ...rows.map((row) => columns.map((col) => row[col.key] ?? '')),
      ];

      const { toBlob } = writeXlsxFile(worksheet, {
        columns: columns.map(() => ({ width: 24 })),
        // The title doubles as the sheet name, which Excel caps at 31 chars.
        sheet: pdfTitle.slice(0, 31),
      });
      downloadBlob(await toBlob(), exportFilename(filenamePrefix, 'xlsx'));
      toast.success(t(successKey));
    } catch {
      toast.error(t(errorKey));
    } finally {
      setExporting(false);
    }
  };

  const handlePdf = async () => {
    setExporting(true);
    try {
      // Deliberately dynamic: keeps the heavy PDF renderer out of the entry
      // chunk until the user actually requests an export.
      const [{ pdf }, { ExportPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./export-button-pdf'),
      ]);
      const text = await fetchCsv();
      const rows = parseCsv(text);
      const blob = await pdf(
        <ExportPdfDocument
          columns={columns}
          pdfTitle={pdfTitle}
          rows={rows}
          subtitle={rangeLabel}
        />
      ).toBlob();
      downloadBlob(blob, exportFilename(filenamePrefix, 'pdf'));
      toast.success(t(successKey));
    } catch {
      toast.error(t(errorKey));
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={hideLabelOnMobile ? t(labelKey) : undefined}
            disabled={exporting}
            size="sm"
            variant="outline"
          >
            <Download className="h-4 w-4" />
            {hideLabelOnMobile ? (
              <span className="hidden sm:inline">{t(labelKey)}</span>
            ) : (
              t(labelKey)
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCsv}>
          <FileText className="h-4 w-4" />
          {t('export.csv')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleXlsx}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('export.excel')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}>
          <FileText className="h-4 w-4" />
          {t('export.pdf')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
