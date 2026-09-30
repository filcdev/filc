import { useTranslation } from 'react-i18next';
import { api } from '@/utils/orpc';
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
    const file = await api.timetable.movedLessons.export({
      from: dateRange?.from?.toISOString().slice(0, 10),
      to: dateRange?.to?.toISOString().slice(0, 10),
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
      successKey="movedLesson.exportSuccess"
    />
  );
}
