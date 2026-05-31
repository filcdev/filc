import notoSansRegular from '@expo-google-fonts/noto-sans/400Regular/NotoSans_400Regular.ttf?url';
import notoSansBold from '@expo-google-fonts/noto-sans/700Bold/NotoSans_700Bold.ttf?url';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

Font.register({
  family: 'NotoSans',
  fonts: [
    { fontWeight: 400, src: notoSansRegular },
    { fontWeight: 700, src: notoSansBold },
  ],
});

// Prevent automatic hyphenation so column headers stay on one line
Font.registerHyphenationCallback((word) => [word]);

export type SubstitutionExportRow = {
  missingTeacher: string;
  substituteTeacher: string;
  cohorts: string;
  period: string;
};

type Labels = {
  missingTeacher: string;
  substituteTeacher: string;
  class: string;
  period: string;
  noSubstitutions: string;
};

type Props = {
  rows: SubstitutionExportRow[];
  date: string;
  labels: Labels;
};

const FONT_STACK = 'NotoSans';

const styles = StyleSheet.create({
  bold: {
    fontWeight: 700,
  },
  cell: {
    flex: 1,
    padding: '6 8',
  },
  dash: {
    color: '#9ca3af',
  },
  header: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 16,
  },
  headerCell: {
    flex: 1,
    fontWeight: 700,
    padding: '6 8',
  },
  headerPeriodCell: {
    flexShrink: 0,
    fontWeight: 700,
    padding: '6 8',
    width: 80,
  },
  page: {
    fontFamily: FONT_STACK,
    fontSize: 10,
    padding: 32,
  },
  periodCell: {
    flexShrink: 0,
    padding: '6 8',
    width: 80,
  },
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    borderBottomColor: '#111827',
    borderBottomWidth: 2,
    flexDirection: 'row',
    marginBottom: 2,
  },
  tableRow: {
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
});

export function SubstitutionPDF({ rows, date, labels }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>{date}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.headerCell}>{labels.missingTeacher}</Text>
            <Text style={styles.headerCell}>{labels.substituteTeacher}</Text>
            <Text style={styles.headerCell}>{labels.class}</Text>
            <Text style={styles.headerPeriodCell}>{labels.period}</Text>
          </View>
          {rows.map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional, no stable id
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.cell, styles.bold]}>
                {row.missingTeacher}
              </Text>
              <Text style={[styles.cell, styles.bold]}>
                {row.substituteTeacher || '-'}
              </Text>
              <Text style={styles.cell}>{row.cohorts || '-'}</Text>
              <Text style={styles.periodCell}>{row.period}</Text>
            </View>
          ))}
          {rows.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.cell, styles.dash, { width: '100%' }]}>
                {labels.noSubstitutions}
              </Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
