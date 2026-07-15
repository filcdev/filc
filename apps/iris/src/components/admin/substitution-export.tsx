import { useTranslation } from 'react-i18next';
import { api } from '@/utils/hc';
import { ExportButton, type ExportColumn } from '../export-button';

const columns: ExportColumn[] = [
  { header: 'Date', key: 'date' },
  { header: 'Teacher', key: 'teacher' },
  { header: 'Subjects', key: 'subjects' },
  { header: 'Cohorts', key: 'cohorts' },
  { header: 'Comment', key: 'comment' },
];

type SubstitutionExportButtonProps = {
  dateRange?: { from?: Date; to?: Date };
};

export function SubstitutionExportButton({
  dateRange,
}: SubstitutionExportButtonProps) {
  const { t } = useTranslation();

  const fetchCsv = async (): Promise<string> => {
    const query: Record<string, string> = {};
    if (dateRange?.from) {
      query.from = dateRange.from.toISOString().slice(0, 10);
    }
    if (dateRange?.to) {
      query.to = dateRange.to.toISOString().slice(0, 10);
    }
    const res = await api.timetable.substitutions.export.$get({ query });
    if (!res.ok) {
      throw new Error('Export failed');
    }
    return res.text();
  };

  return (
    <ExportButton
      columns={columns}
      errorKey="substitution.exportError"
      fetchCsv={fetchCsv}
      filenamePrefix="substitutions"
      labelKey="substitution.export"
      pdfTitle={t('substitution.exportTitle')}
      successKey="substitution.exportSuccess"
    />
  );
}
