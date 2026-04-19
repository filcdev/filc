import { StyleSheet } from '@react-pdf/renderer';

// Hex equivalents of the Tailwind ACCENT_COLORS palette in helpers.ts
// Order must match: blue, emerald, amber, purple, rose, cyan
const COLOR_PALETTE = [
  { bg: '#EFF6FF', border: '#3B82F6' }, // blue
  { bg: '#ECFDF5', border: '#10B981' }, // emerald
  { bg: '#FFFBEB', border: '#F59E0B' }, // amber
  { bg: '#F5F3FF', border: '#8B5CF6' }, // purple
  { bg: '#FFF1F2', border: '#F43F5E' }, // rose
  { bg: '#ECFEFF', border: '#06B6D4' }, // cyan
] as const;

const BW_COLOR = { bg: '#F3F4F6', border: '#9CA3AF' };

/** Mirror of getSubjectColor from helpers.ts — returns hex colours for PDF */
export function getPdfSubjectColor(
  name: string,
  blackAndWhite: boolean
): { bg: string; border: string } {
  if (blackAndWhite) {
    return BW_COLOR;
  }
  let sum = 0;
  for (const ch of name) {
    sum += ch.codePointAt(0) ?? 0;
  }
  return (
    COLOR_PALETTE[Math.abs(sum) % COLOR_PALETTE.length] ?? COLOR_PALETTE[0]
  );
}

export const styles = StyleSheet.create({
  // ── Day cells ────────────────────────────────────────────────────────────────
  dayCell: {
    borderRight: '1 solid #E5E7EB',
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    padding: 3,
  },
  dayCellLast: {
    borderRight: 0,
  },
  dayHeaderCell: {
    color: '#6B7280',
    flex: 1,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    letterSpacing: 0.8,
    padding: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  dayHeaderCorner: {
    borderRight: '1 solid #E5E7EB',
    width: 52,
  },

  // ── Day header row ──────────────────────────────────────────────────────────
  dayHeaderRow: {
    backgroundColor: '#F9FAFB',
    borderBottom: '1 solid #E5E7EB',
    flexDirection: 'row',
  },

  // ── Grid wrapper ────────────────────────────────────────────────────────────
  grid: {
    border: '1 solid #E5E7EB',
    borderRadius: 4,
    flexDirection: 'column',
    overflow: 'hidden',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerCenter: {
    color: '#374151',
    flex: 1,
    fontSize: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  headerLeft: {
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
  },
  headerRight: {
    color: '#9CA3AF',
    fontSize: 7,
    textAlign: 'right',
  },

  // ── Lesson card ─────────────────────────────────────────────────────────────
  lessonCard: {
    borderLeftWidth: 3,
    borderRadius: 3,
    flexDirection: 'column',
    paddingBottom: 4,
    paddingHorizontal: 5,
    paddingTop: 4,
  },
  lessonMeta: {
    color: '#6B7280',
    fontSize: 7,
    marginTop: 2,
  },
  lessonSubjectFull: {
    color: '#374151',
    fontFamily: 'Helvetica-Oblique',
    fontSize: 7,
    marginTop: 1,
  },
  lessonSubjectShort: {
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    lineHeight: 1.2,
  },
  page: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
    fontFamily: 'Helvetica',
    padding: 20,
  },

  // ── Period rows ─────────────────────────────────────────────────────────────
  periodRow: {
    borderBottom: '1 solid #E5E7EB',
    flexDirection: 'row',
    minHeight: 44,
  },
  periodRowLast: {
    borderBottom: 0,
  },
  timeCell: {
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRight: '1 solid #E5E7EB',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingVertical: 4,
    width: 52,
  },
  timeCellIndex: {
    color: '#374151',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  timeCellTime: {
    color: '#9CA3AF',
    fontSize: 6.5,
    marginTop: 1,
  },
});
