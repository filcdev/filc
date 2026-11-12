import type { CSSProperties } from 'react';
import type { EmailAccent } from './types';

const FONT_STACK =
  '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Accent identity of a notification email. `band` is the solid colour that
 * carries white text, `soft` the pale tint for panels, `border` the outline
 * between a tint and the page, and `text` the accent readable on `soft`.
 */
const accents: Record<
  EmailAccent,
  { band: string; soft: string; border: string; text: string }
> = {
  amber: {
    band: '#b45309',
    border: '#fde68a',
    soft: '#fffbeb',
    text: '#b45309',
  },
  blue: {
    band: '#1d4ed8',
    border: '#bfdbfe',
    soft: '#eff6ff',
    text: '#1d4ed8',
  },
  indigo: {
    band: '#4338ca',
    border: '#c7d2fe',
    soft: '#eef2ff',
    text: '#4338ca',
  },
  orange: {
    band: '#c2410c',
    border: '#fed7aa',
    soft: '#fff7ed',
    text: '#c2410c',
  },
  rose: {
    band: '#be123c',
    border: '#fecdd3',
    soft: '#fff1f2',
    text: '#be123c',
  },
  slate: {
    band: '#334155',
    border: '#e2e8f0',
    soft: '#f8fafc',
    text: '#334155',
  },
  teal: {
    band: '#0f766e',
    border: '#99f6e4',
    soft: '#ecfdf5',
    text: '#0f766e',
  },
  violet: {
    band: '#6d28d9',
    border: '#ddd6fe',
    soft: '#f5f3ff',
    text: '#6d28d9',
  },
};

export const bodyStyle: CSSProperties = {
  backgroundColor: '#f4f5f7',
  color: '#18181b',
  fontFamily: FONT_STACK,
  lineHeight: 1.6,
  margin: 0,
  padding: '24px 12px',
  WebkitFontSmoothing: 'antialiased',
};

export const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '18px',
  boxShadow:
    '0 1px 3px rgba(24, 24, 27, 0.08), 0 8px 24px rgba(24, 24, 27, 0.06)',
  margin: '0 auto',
  maxWidth: '600px',
  overflow: 'hidden',
  width: '100%',
};

export const headerStyle = (accent: EmailAccent): CSSProperties => ({
  backgroundColor: accents[accent].band,
  color: '#ffffff',
  padding: '26px 28px 30px',
});

export const monogramStyle: CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.18)',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '17px',
  fontWeight: 700,
  height: '34px',
  lineHeight: '34px',
  margin: 0,
  textAlign: 'center',
  width: '34px',
};

export const wordmarkStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  lineHeight: '34px',
  margin: 0,
  paddingLeft: '10px',
  verticalAlign: 'middle',
};

export const brandMarkCellStyle: CSSProperties = {
  padding: '0 0 16px',
  verticalAlign: 'middle',
  width: '34px',
};

export const brandWordmarkCellStyle: CSSProperties = {
  padding: '0 0 16px',
  verticalAlign: 'middle',
};

export const typePillStyle: CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.18)',
  borderRadius: '999px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  lineHeight: 1.6,
  margin: '0 0 10px',
  padding: '3px 10px',
  textTransform: 'uppercase',
};

export const titleStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: 1.3,
  margin: '14px 0 0',
};

export const bodyContentStyle: CSSProperties = {
  color: '#3f3f46',
  fontSize: '15px',
  lineHeight: 1.6,
  padding: '22px 28px 24px',
};

export const heroStyle = (accent: EmailAccent): CSSProperties => ({
  backgroundColor: accents[accent].soft,
  border: `1px solid ${accents[accent].border}`,
  borderRadius: '14px',
  margin: '0 0 4px',
  padding: '18px 20px',
});

export const heroGreetingStyle = (accent: EmailAccent): CSSProperties => ({
  color: accents[accent].text,
  fontSize: '13px',
  fontWeight: 600,
  margin: '0 0 6px',
});

export const heroLeadStyle: CSSProperties = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: 1.45,
  margin: 0,
};

export const chipRowStyle: CSSProperties = {
  margin: '12px 0 0',
};

export const chipStyle = (accent: EmailAccent): CSSProperties => ({
  backgroundColor: '#ffffff',
  border: `1px solid ${accents[accent].border}`,
  borderRadius: '999px',
  color: accents[accent].text,
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  lineHeight: 1.6,
  marginBottom: '6px',
  marginRight: '6px',
  padding: '4px 11px',
});

export const textStyle: CSSProperties = {
  lineHeight: 1.6,
  margin: '0 0 16px',
};

export const dividerStyle = (accent: EmailAccent): CSSProperties => ({
  border: 'none',
  borderTop: `1px solid ${accents[accent].border}`,
  margin: '20px 0 16px',
  width: '100%',
});

export const detailsSectionStyle = (accent: EmailAccent): CSSProperties => ({
  backgroundColor: accents[accent].soft,
  borderRadius: '12px',
  margin: '4px 0 18px',
  padding: '16px 18px',
});

export const detailLabelStyle: CSSProperties = {
  color: '#475569',
  fontSize: '11px',
  letterSpacing: '0.04em',
  margin: 0,
  paddingBottom: 2,
  textTransform: 'uppercase',
};

export const detailValueStyle: CSSProperties = {
  color: '#18181b',
  fontSize: '14px',
  lineHeight: 1.45,
  margin: 0,
};

/**
 * The separator sits on the cells, not the row: Outlook's Word engine does not
 * paint `border` on a `<tr>`, but it honours it on a `<td>`.
 */
const detailRowBorder = (accent: EmailAccent, index: number): CSSProperties =>
  index === 0 ? {} : { borderTop: `1px solid ${accents[accent].border}` };

export const detailLabelCellStyle = (
  accent: EmailAccent,
  index: number
): CSSProperties => ({
  ...detailRowBorder(accent, index),
  padding: '7px 12px 7px 0',
  verticalAlign: 'top',
  width: '38%',
});

export const detailValueCellStyle = (
  accent: EmailAccent,
  index: number
): CSSProperties => ({
  ...detailRowBorder(accent, index),
  padding: '7px 0',
  verticalAlign: 'top',
});

export const buttonStyle = (accent: EmailAccent): CSSProperties => ({
  backgroundColor: accents[accent].band,
  borderRadius: '999px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.6,
  marginTop: '8px',
  padding: '11px 26px',
  textDecoration: 'none',
});

export const footerStyle = (accent: EmailAccent): CSSProperties => ({
  backgroundColor: accents[accent].soft,
  borderTop: `1px solid ${accents[accent].border}`,
  color: '#71717a',
  fontSize: '12px',
  lineHeight: 1.6,
  padding: '18px 28px',
});

export const footerBrandStyle = (accent: EmailAccent): CSSProperties => ({
  color: accents[accent].text,
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.16em',
  lineHeight: 1.6,
  margin: '0 0 8px',
  textTransform: 'uppercase',
});

export const footerTextStyle: CSSProperties = {
  color: '#52525b',
  fontSize: '12px',
  lineHeight: 1.6,
  margin: '0 0 6px',
};

export const footerLinkStyle = (accent: EmailAccent): CSSProperties => ({
  color: accents[accent].text,
  textDecoration: 'none',
});
