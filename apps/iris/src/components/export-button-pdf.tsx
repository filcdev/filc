import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ExportColumn } from './export-button';

const pdfStyles = StyleSheet.create({
  cell: { flex: 1, paddingRight: 6 },
  headerRow: { borderBottomWidth: 1.5, fontWeight: 'bold' },
  page: { fontSize: 9, padding: 24 },
  row: {
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 3,
  },
  subtitle: { color: '#666', fontSize: 9, marginBottom: 12 },
  table: { display: 'flex', flexDirection: 'column', width: '100%' },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
});

export function ExportPdfDocument({
  columns,
  pdfTitle,
  rows,
  subtitle,
}: {
  columns: ExportColumn[];
  pdfTitle: string;
  rows: Record<string, string>[];
  subtitle: string;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>{pdfTitle}</Text>
        <Text style={pdfStyles.subtitle}>{subtitle}</Text>
        <View style={[pdfStyles.row, pdfStyles.headerRow]}>
          {columns.map((col) => (
            <Text key={col.key} style={pdfStyles.cell}>
              {col.header}
            </Text>
          ))}
        </View>
        {rows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static PDF rows, no reordering
          <View key={index} style={pdfStyles.row}>
            {columns.map((col) => (
              <Text key={col.key} style={pdfStyles.cell}>
                {row[col.key] ?? ''}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
