import { useTranslation } from 'react-i18next';
import { api } from '@/utils/orpc';
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
    const file = await api.timetable.substitutions.export({
      from: dateRange?.from?.toISOString().slice(0, 10),
      to: dateRange?.to?.toISOString().slice(0, 10),
    });
    return await file.text();
  };

  return (
    <ExportButton
      columns={columns}
      errorKey="substitution.exportError"
      fetchCsv={fetchCsv}
      filenamePrefix="substitutions"
      hideLabelOnMobile
      labelKey="substitution.export"
      pdfTitle={t('substitution.exportTitle')}
      successKey="substitution.exportSuccess"
    />
  );
}
