import { useTranslation } from 'react-i18next';
import { api } from '@/utils/orpc';
import { ExportButton, type ExportColumn } from '../export-button';
import { useExportRange } from './use-export-range';

type MovedLessonExportButtonProps = {
  dateRange?: { from?: Date; to?: Date };
};

export function MovedLessonExportButton({
  dateRange,
}: MovedLessonExportButtonProps) {
  const { t } = useTranslation();
  const range = useExportRange(dateRange);

  // Keys match the CSV header the backend writes (`#modules/timetable/export`);
  // the labels are localized here so every export carries readable headers.
  const columns: ExportColumn[] = [
    { header: t('movedLesson.date'), key: 'date' },
    { header: t('movedLesson.targetDay'), key: 'target_day' },
    { header: t('movedLesson.targetPeriod'), key: 'target_period' },
    { header: t('movedLesson.targetRoom'), key: 'target_room' },
    { header: t('export.subjects'), key: 'lessons' },
    { header: t('movedLesson.lessonsCount'), key: 'lesson_count' },
  ];

  const fetchCsv = async (): Promise<string> => {
    const file = await api.timetable.movedLessons.export({
      from: range.from,
      to: range.to,
    });
    return await file.text();
  };

  return (
    <ExportButton
      columns={columns}
      errorKey="movedLesson.exportError"
      fetchCsv={fetchCsv}
      filenamePrefix="moved-lessons"
      hideLabelOnMobile
      labelKey="movedLesson.export"
      pdfTitle={t('movedLesson.exportTitle')}
      rangeLabel={range.label}
      successKey="movedLesson.exportSuccess"
    />
  );
}
