import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { LogRow } from './export-logs';

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

export function LogsPdfDocument({
  rows,
  rangeLabel,
}: {
  rows: LogRow[];
  rangeLabel: string;
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Doorlock export</Text>
        <Text style={pdfStyles.subtitle}>{rangeLabel}</Text>
        <View style={[pdfStyles.row, pdfStyles.headerRow]}>
          <Text style={pdfStyles.cell}>Timestamp</Text>
          <Text style={pdfStyles.cell}>Device</Text>
          <Text style={pdfStyles.cell}>User</Text>
          <Text style={pdfStyles.cell}>Card</Text>
          <Text style={pdfStyles.cell}>Result</Text>
        </View>
        {rows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static PDF rows, no reordering
          <View key={index} style={pdfStyles.row}>
            <Text style={pdfStyles.cell}>{row.timestamp}</Text>
            <Text style={pdfStyles.cell}>{row.device?.name ?? ''}</Text>
            <Text style={pdfStyles.cell}>
              {row.owner?.nickname || row.owner?.name || row.owner?.email || ''}
            </Text>
            <Text style={pdfStyles.cell}>{row.card?.name ?? ''}</Text>
            <Text style={pdfStyles.cell}>
              {row.result ? 'granted' : 'denied'}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
