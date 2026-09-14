import { Button } from '@filcdev/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@filcdev/ui/components/dropdown-menu';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type ExportColumn = {
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
  /** Columns to render in the PDF table. */
  columns: ExportColumn[];
  /** Fetches the raw CSV text from the backend. */
  fetchCsv: () => Promise<string>;
};

const CSV_SPECIAL_CHARS = /[",\n\r]/;
const CSV_QUOTE = /"/g;

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (CSV_SPECIAL_CHARS.test(str)) {
    return `"${str.replace(CSV_QUOTE, '""')}"`;
  }
  return str;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length <= 1) {
    return [];
  }
  const header = (lines[0] ?? '').split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] ?? '';
    });
    return obj;
  });
}

export function rowsToCsv(
  header: string[],
  rows: Record<string, unknown>[]
): string {
  const lines = rows.map((row) =>
    header.map((col) => escapeCsv(row[col])).join(',')
  );
  return [header.join(','), ...lines].join('\n');
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

export function ExportButton({
  columns,
  errorKey,
  fetchCsv,
  filenamePrefix,
  hideLabelOnMobile = false,
  labelKey = 'export',
  pdfTitle,
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
        `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
      );
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
          subtitle={t('export.rangeLabel')}
        />
      ).toBlob();
      downloadBlob(
        blob,
        `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`
      );
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
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf}>
          <FileText className="h-4 w-4" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
