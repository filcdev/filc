import { useTranslation } from 'react-i18next';
import { api } from '@/utils/hc';
import { ExportButton, type ExportColumn } from '../export-button';

const columns: ExportColumn[] = [
  { header: 'Date', key: 'date' },
  { header: 'Target day', key: 'target_day' },
  { header: 'Target period', key: 'target_period' },
  { header: 'Target room', key: 'target_room' },
  { header: 'Lessons', key: 'lessons' },
  { header: 'Lesson count', key: 'lesson_count' },
];

type MovedLessonExportButtonProps = {
  dateRange?: { from?: Date; to?: Date };
};

export function MovedLessonExportButton({
  dateRange,
}: MovedLessonExportButtonProps) {
  const { t } = useTranslation();

  const fetchCsv = async (): Promise<string> => {
    const query: Record<string, string> = {};
    if (dateRange?.from) {
      query.from = dateRange.from.toISOString().slice(0, 10);
    }
    if (dateRange?.to) {
      query.to = dateRange.to.toISOString().slice(0, 10);
    }
    const res = await api.timetable.movedLessons.export.$get({ query });
    if (!res.ok) {
      throw new Error('Export failed');
    }
    return res.text();
  };

  return (
    <ExportButton
      columns={columns}
      errorKey="movedLesson.exportError"
      fetchCsv={fetchCsv}
      filenamePrefix="moved-lessons"
      labelKey="movedLesson.export"
      pdfTitle={t('movedLesson.exportTitle')}
      successKey="movedLesson.exportSuccess"
    />
  );
}
