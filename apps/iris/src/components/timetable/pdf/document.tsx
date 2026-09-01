import { Document, Page, Text, View } from '@react-pdf/renderer';
import { formatCohorts, formatRooms, formatTeachers, toHHMM } from '../helpers';
import type { FilterType, LessonItem, TimetableViewModel } from '../types';
import { getPdfSubjectColor, styles } from './styles';

// Number of period rows per PDF page. Each row has minHeight 44, and the A4
// landscape content area is ~510pt tall, so 11 rows fit without clipping.
const ROWS_PER_PAGE = 11;

function chunkRows<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type Props = {
  model: TimetableViewModel;
  blackAndWhite: boolean;
  label: string;
  timetableName: string;
  generatedAt: string;
  activeFilter: FilterType;
};

function LessonCard({
  lesson,
  blackAndWhite,
  activeFilter,
}: {
  lesson: LessonItem;
  blackAndWhite: boolean;
  activeFilter: FilterType;
}) {
  const subjectName = lesson.subject?.name ?? '';
  const subjectShort = lesson.subject?.short ?? subjectName;
  const color = getPdfSubjectColor(subjectName, blackAndWhite);
  const teachers = formatTeachers(lesson.teachers);
  const rooms = formatRooms(lesson.classrooms);
  const cohorts =
    activeFilter === 'teacher' || activeFilter === 'classroom'
      ? formatCohorts(lesson.cohorts)
      : '';
  const showFullName = subjectName !== '' && subjectName !== subjectShort;
  const meta = [cohorts, teachers, rooms].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        styles.lessonCard,
        { backgroundColor: color.bg, borderLeftColor: color.border },
      ]}
    >
      <Text style={styles.lessonSubjectShort}>{subjectShort}</Text>
      {showFullName && (
        <Text style={styles.lessonSubjectFull}>{subjectName}</Text>
      )}
      {meta !== '' && <Text style={styles.lessonMeta}>{meta}</Text>}
    </View>
  );
}

export function TimetablePDF({
  model,
  blackAndWhite,
  label,
  timetableName,
  generatedAt,
  activeFilter,
}: Props) {
  const { days, timeSlots, grid } = model;
  const chunks = chunkRows(timeSlots, ROWS_PER_PAGE);

  return (
    <Document>
      {chunks.map((slots, pageIdx) => (
        <Page
          // biome-ignore lint/suspicious/noArrayIndexKey: static PDF pages, no reordering
          key={pageIdx}
          orientation="landscape"
          size="A4"
          style={styles.page}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerLeft}>{timetableName}</Text>
            <Text style={styles.headerCenter}>{label}</Text>
            <Text style={styles.headerRight}>{generatedAt}</Text>
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {/* Day header row */}
            <View style={styles.dayHeaderRow}>
              <View style={styles.dayHeaderCorner} />
              {days.map((day, i) => (
                <Text
                  key={day.key}
                  style={[
                    styles.dayHeaderCell,
                    i === days.length - 1 ? { borderRight: 0 } : {},
                  ]}
                >
                  {day.label.toUpperCase()}
                </Text>
              ))}
            </View>

            {/* Period rows */}
            {slots.map((slot, rowIdx) => {
              const isLastRow = rowIdx === slots.length - 1;

              return (
                <View
                  key={slot.start.format('HH:mm')}
                  style={[
                    styles.periodRow,
                    isLastRow ? styles.periodRowLast : {},
                  ]}
                  wrap={false}
                >
                  {/* Time cell */}
                  <View style={styles.timeCell}>
                    <Text style={styles.timeCellIndex}>{slot.index}.</Text>
                    <Text style={styles.timeCellTime}>
                      {toHHMM(slot.start.format('HH:mm:ss'))}
                    </Text>
                    <Text style={styles.timeCellTime}>
                      {toHHMM(slot.end.format('HH:mm:ss'))}
                    </Text>
                  </View>

                  {/* Day cells */}
                  {days.map((day, colIdx) => {
                    const cellKey = `${day.key}-${slot.start.format('HH:mm')}`;
                    const lessons: LessonItem[] =
                      grid.get(cellKey)?.lessons ?? [];
                    const isLastCol = colIdx === days.length - 1;

                    return (
                      <View
                        key={cellKey}
                        style={[
                          styles.dayCell,
                          isLastCol ? styles.dayCellLast : {},
                        ]}
                      >
                        {lessons.length === 1 &&
                        (lessons[0]?.groupsIds?.length ?? 0) > 0 ? (
                          // Single group-scoped lesson: show half-width with empty sibling
                          <View
                            style={{ flex: 1, flexDirection: 'row', gap: 2 }}
                          >
                            <LessonCard
                              activeFilter={activeFilter}
                              blackAndWhite={blackAndWhite}
                              // biome-ignore lint/style/noNonNullAssertion: length checked above
                              lesson={lessons[0]!}
                            />
                            <View style={{ flex: 1 }} />
                          </View>
                        ) : (
                          lessons.map((lesson, idx) => (
                            <LessonCard
                              activeFilter={activeFilter}
                              blackAndWhite={blackAndWhite}
                              key={lesson.id ?? idx}
                              lesson={lesson}
                            />
                          ))
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </Page>
      ))}
    </Document>
  );
}
