import { useTranslation } from 'react-i18next';
import { api } from '@/utils/orpc';
import { ExportButton, type ExportColumn } from '../export-button';
import { useExportRange } from './use-export-range';

type SubstitutionExportButtonProps = {
  dateRange?: { from?: Date; to?: Date };
};

export function SubstitutionExportButton({
  dateRange,
}: SubstitutionExportButtonProps) {
  const { t } = useTranslation();
  const range = useExportRange(dateRange);

  // Keys match the CSV header the backend writes (`#modules/timetable/export`);
  // the labels are localized here so every export carries readable headers.
  const columns: ExportColumn[] = [
    { header: t('substitution.date'), key: 'date' },
    { header: t('substitution.substituteTeacher'), key: 'teacher' },
    { header: t('export.subjects'), key: 'subjects' },
    { header: t('substitution.cohorts'), key: 'cohorts' },
    { header: t('substitution.comment'), key: 'comment' },
  ];

  const fetchCsv = async (): Promise<string> => {
    const file = await api.timetable.substitutions.export({
      from: range.from,
      to: range.to,
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
      rangeLabel={range.label}
      successKey="substitution.exportSuccess"
    />
  );
}
