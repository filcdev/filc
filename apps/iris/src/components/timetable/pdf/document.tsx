import { Document, Page, Text, View } from '@react-pdf/renderer';
import { formatRooms, formatTeachers, toHHMM } from '../helpers';
import type { LessonItem, TimetableViewModel } from '../types';
import { getPdfSubjectColor, styles } from './styles';

type Props = {
  model: TimetableViewModel;
  blackAndWhite: boolean;
  label: string;
  timetableName: string;
  generatedAt: string;
};

function LessonCard({
  lesson,
  blackAndWhite,
}: {
  lesson: LessonItem;
  blackAndWhite: boolean;
}) {
  const subjectName = lesson.subject?.name ?? '';
  const subjectShort = lesson.subject?.short ?? subjectName;
  const color = getPdfSubjectColor(subjectName, blackAndWhite);
  const teachers = formatTeachers(lesson.teachers);
  const rooms = formatRooms(lesson.classrooms);
  const showFullName = subjectName !== '' && subjectName !== subjectShort;
  const meta = [teachers, rooms].filter(Boolean).join(' · ');

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
}: Props) {
  const { days, timeSlots, grid } = model;

  return (
    <Document>
      <Page orientation="landscape" size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLeft}>{timetableName}</Text>
          <Text style={styles.headerCenter}>{label}</Text>
          <Text style={styles.headerRight}>{generatedAt}</Text>
        </View>

        {/* Grid */}
        <View style={styles.grid} wrap={false}>
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
          {timeSlots.map((slot, rowIdx) => {
            const isLastRow = rowIdx === timeSlots.length - 1;

            return (
              <View
                key={slot.start.format('HH:mm')}
                style={[
                  styles.periodRow,
                  isLastRow ? styles.periodRowLast : {},
                ]}
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
                        <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
                          <LessonCard
                            blackAndWhite={blackAndWhite}
                            // biome-ignore lint/style/noNonNullAssertion: length checked above
                            lesson={lessons[0]!}
                          />
                          <View style={{ flex: 1 }} />
                        </View>
                      ) : (
                        lessons.map((lesson, idx) => (
                          <LessonCard
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
    </Document>
  );
}
