import { Button } from '@filcdev/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@filcdev/ui/components/dropdown-menu';
import dayjs from 'dayjs';
import { Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';

type ExportFilters = {
  accessFilter: 'all' | 'granted' | 'denied';
  cardFilter: 'all' | string;
  dateRange: { from?: Date; to?: Date };
  deviceFilter: 'all' | string;
  eventFilter: 'all' | 'virtual' | 'physical';
  search: string;
  userFilter: 'all' | string;
};

function buildQuery(filters: ExportFilters): Record<string, string> {
  const query: Record<string, string> = { limit: '1000' };
  if (filters.deviceFilter !== 'all') {
    query.deviceId = filters.deviceFilter;
  }
  if (filters.cardFilter !== 'all') {
    query.cardId = filters.cardFilter;
  }
  if (filters.userFilter !== 'all') {
    query.userId = filters.userFilter;
  }
  if (filters.accessFilter === 'granted') {
    query.granted = 'true';
  } else if (filters.accessFilter === 'denied') {
    query.granted = 'false';
  }
  if (filters.dateRange.from) {
    query.from = filters.dateRange.from.toISOString();
  }
  if (filters.dateRange.to) {
    query.to = filters.dateRange.to.toISOString();
  }
  if (filters.search) {
    query.search = filters.search;
  }
  return query;
}

function triggeredByLabel(log: {
  buttonPressed: boolean;
  cardId: string | null;
}): string {
  if (log.buttonPressed && log.cardId) {
    return 'Virtual card';
  }
  if (log.buttonPressed) {
    return 'Physical button';
  }
  return 'Card swipe';
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

const CSV_SPECIAL_CHARS = /[",\n\r]/;
const CSV_QUOTE = /"/g;

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (CSV_SPECIAL_CHARS.test(str)) {
    return `"${str.replace(CSV_QUOTE, '""')}"`;
  }
  return str;
}

export type LogRow = {
  buttonPressed: boolean;
  cardData: string | null;
  cardId: string | null;
  card?: { name: string | null } | null;
  device?: { name: string | null } | null;
  owner?: {
    email: string | null;
    name: string | null;
    nickname: string | null;
  } | null;
  result: boolean;
  timestamp: string;
};

function toCsv(rows: LogRow[]): string {
  const header = [
    'timestamp',
    'device',
    'user',
    'card',
    'card_uid',
    'triggered_by',
    'result',
  ];
  const lines = rows.map((row) =>
    [
      row.timestamp,
      row.device?.name ?? '',
      row.owner?.nickname || row.owner?.name || row.owner?.email || '',
      row.card?.name ?? '',
      row.cardData ?? '',
      triggeredByLabel(row),
      row.result ? 'granted' : 'denied',
    ]
      .map(escapeCsv)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export function ExportLogsButton(filters: ExportFilters) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const rangeLabel = filters.dateRange.from
    ? `${dayjs(filters.dateRange.from).format('YYYY-MM-DD')} - ${
        filters.dateRange.to
          ? dayjs(filters.dateRange.to).format('YYYY-MM-DD')
          : 'now'
      }`
    : 'all time';

  const fetchLogs = async (): Promise<LogRow[]> => {
    const query = buildQuery(filters);
    const res = await api.doorlock.logs.export.$get({ query });
    if (!res.ok) {
      throw new Error('Export failed');
    }
    const text = await res.text();
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
      return {
        buttonPressed: obj.triggered_by === 'Physical button',
        card: { name: obj.card || null },
        cardData: obj.card_uid || null,
        cardId: obj.triggered_by === 'Virtual card' ? 'virtual' : null,
        device: { name: obj.device || null },
        owner: {
          email: null,
          name: obj.user || null,
          nickname: null,
        },
        result: obj.result === 'granted',
        timestamp: obj.timestamp ?? '',
      } satisfies LogRow;
    });
  };

  const handleCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchLogs();
      const csv = toCsv(rows);
      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `doorlock-export-${dayjs().format('YYYY-MM-DD')}.csv`
      );
      toast.success(t('doorlockLogs.exportSuccess'));
    } catch {
      toast.error(t('doorlockLogs.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const handlePdf = async () => {
    setExporting(true);
    try {
      // Deliberately dynamic: keeps the heavy PDF renderer out of the entry
      // chunk until the user actually requests an export.
      const [{ pdf }, { LogsPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./logs-pdf-document'),
      ]);
      const rows = await fetchLogs();
      const blob = await pdf(
        <LogsPdfDocument rangeLabel={rangeLabel} rows={rows} />
      ).toBlob();
      downloadBlob(blob, `doorlock-export-${dayjs().format('YYYY-MM-DD')}.pdf`);
      toast.success(t('doorlockLogs.exportSuccess'));
    } catch {
      toast.error(t('doorlockLogs.exportError'));
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
            {t('doorlockLogs.export')}
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
