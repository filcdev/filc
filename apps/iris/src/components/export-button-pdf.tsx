import outfitLatin from '@fontsource/outfit/files/outfit-latin-400-normal.woff';
import outfitLatinExtraBold from '@fontsource/outfit/files/outfit-latin-700-normal.woff';
import outfitLatinExt from '@fontsource/outfit/files/outfit-latin-ext-400-normal.woff';
import outfitLatinExtBold from '@fontsource/outfit/files/outfit-latin-ext-700-normal.woff';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ExportColumn } from './export-button';

// The built-in PDF fonts are standard-14 Helvetica, encoded as WinAnsi, which
// cannot represent the Hungarian double acutes (ő, ű) that appear in every
// substitution and moved-lesson name. Embed Outfit (the app's own typeface)
// instead: the `latin` subset carries ASCII and the Latin-1 accents, the
// `latin-ext` subset carries ő/ű/Ő/Ű. react-pdf resolves a `fontFamily` array
// glyph by glyph, so the two subsets complement each other.
//
// `.woff`, never `.woff2`: fontkit's woff2 (Brotli) decoder produces glyph
// data that the react-pdf subsetter then corrupts, which throws mid-export.
const LATIN = 'Outfit Latin';
const LATIN_EXT = 'Outfit Latin Extended';

Font.register({
  family: LATIN,
  fonts: [
    { src: outfitLatin },
    { fontWeight: 'bold', src: outfitLatinExtraBold },
  ],
});

Font.register({
  family: LATIN_EXT,
  fonts: [
    { src: outfitLatinExt },
    { fontWeight: 'bold', src: outfitLatinExtBold },
  ],
});

/** Font stack every export document renders with (`Helvetica` is appended by react-pdf). */
export const EXPORT_FONT_FAMILIES = [LATIN, LATIN_EXT];

const pdfStyles = StyleSheet.create({
  cell: { flex: 1, fontFamily: EXPORT_FONT_FAMILIES, paddingRight: 6 },
  headerRow: { borderBottomWidth: 1.5, fontWeight: 'bold' },
  page: { fontFamily: EXPORT_FONT_FAMILIES, fontSize: 9, padding: 24 },
  row: {
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingVertical: 3,
  },
  subtitle: {
    color: '#666',
    fontFamily: EXPORT_FONT_FAMILIES,
    fontSize: 9,
    marginBottom: 12,
  },
  table: { display: 'flex', flexDirection: 'column', width: '100%' },
  title: {
    fontFamily: EXPORT_FONT_FAMILIES,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
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
