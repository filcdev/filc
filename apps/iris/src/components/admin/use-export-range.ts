import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDate } from '@/utils/date-locale';

type DateRange = { from?: Date; to?: Date };

export type ExportRange = {
  /** ISO `YYYY-MM-DD` query params, in the viewer's own timezone. */
  from?: string;
  to?: string;
  /** Human-readable range for the PDF subtitle and the spreadsheet heading. */
  label: string;
};

/**
 * Turn the picker's local-midnight range into the export query params and a
 * label describing them. The label keeps every exported file self-describing
 * about the range it covers.
 *
 * The params are formatted with dayjs rather than `toISOString().slice(0, 10)`
 * for the same reason `DateRangePicker` does: the picker returns local
 * midnights, so the ISO conversion moves each one a day earlier everywhere east
 * of UTC — a range ending 2026-10-10 would request `to=2026-10-09` and silently
 * drop the last day.
 */
export function useExportRange(dateRange?: DateRange): ExportRange {
  const { i18n, t } = useTranslation();

  const from = dateRange?.from;
  const to = dateRange?.to;

  let label = t('export.rangeAll');
  if (from && to) {
    label = t('export.rangeBetween', {
      from: formatLocalizedDate(from, i18n.language),
      to: formatLocalizedDate(to, i18n.language),
    });
  } else if (from) {
    label = t('export.rangeFrom', {
      date: formatLocalizedDate(from, i18n.language),
    });
  } else if (to) {
    label = t('export.rangeUntil', {
      date: formatLocalizedDate(to, i18n.language),
    });
  }

  return {
    from: from ? dayjs(from).format('YYYY-MM-DD') : undefined,
    label,
    to: to ? dayjs(to).format('YYYY-MM-DD') : undefined,
  };
}
