import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ExportColumn = {
  header: string;
  key: string;
};

type ExportButtonProps = {
  /** i18n key for the button label (defaults to `export`). */
  labelKey?: string;
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

const pdfStyles = StyleSheet.create({
  cell: { flex: 1, paddingRight: 6 },
  headerRow: { borderBottomWidth: 1.5, fontWeight: 'bold' },
  page: { fontSize: 9, padding: 24 },
  row: {
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 3,
  },
  subtitle: { color: '#666', fontSize: 9, marginBottom: 12 },
  table: { display: 'flex', flexDirection: 'column', width: '100%' },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
});

function ExportPdfDocument({
  columns,
  pdfTitle,
  rows,
  subtitle,
}: {
  columns: ExportColumn[];
  pdfTitle: string;
  rows: Record<string, string>[];
  subtitle: string;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>{pdfTitle}</Text>
        <Text style={pdfStyles.subtitle}>{subtitle}</Text>
        <View style={[pdfStyles.row, pdfStyles.headerRow]}>
          {columns.map((col) => (
            <Text key={col.key} style={pdfStyles.cell}>
              {col.header}
            </Text>
          ))}
        </View>
        {rows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static PDF rows, no reordering
          <View key={index} style={pdfStyles.row}>
            {columns.map((col) => (
              <Text key={col.key} style={pdfStyles.cell}>
                {row[col.key] ?? ''}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export function ExportButton({
  columns,
  errorKey,
  fetchCsv,
  filenamePrefix,
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
      const { pdf } = await import('@react-pdf/renderer');
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
          <Button disabled={exporting} size="sm" variant="outline">
            <Download className="h-4 w-4" />
            {t(labelKey)}
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
