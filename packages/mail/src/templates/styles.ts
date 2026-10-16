import type { CSSProperties } from 'react';

const FONT_STACK =
  '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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

export const headerStyle: CSSProperties = {
  backgroundColor: '#0d9488',
  color: '#ffffff',
  padding: '28px',
};

export const typePillStyle: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.16)',
  borderRadius: '999px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.02em',
  lineHeight: 1.6,
  margin: '0 0 10px',
  padding: '4px 12px',
};

export const titleStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: '21px',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  margin: 0,
};

export const bodyContentStyle: CSSProperties = {
  color: '#3f3f46',
  fontSize: '15px',
  lineHeight: 1.6,
  padding: '26px 28px',
};

export const greetingStyle: CSSProperties = {
  color: '#18181b',
  fontWeight: 600,
  lineHeight: 1.6,
  margin: '0 0 12px',
};

export const textStyle: CSSProperties = {
  lineHeight: 1.6,
  margin: '0 0 16px',
};

export const buttonStyle: CSSProperties = {
  backgroundColor: '#0d9488',
  borderRadius: '26px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.6,
  marginTop: '8px',
  padding: '10px 24px',
  textDecoration: 'none',
};

export const footerStyle: CSSProperties = {
  backgroundColor: '#fafafa',
  borderTop: '1px solid #f0f0f2',
  color: '#71717a',
  fontSize: '12px',
  lineHeight: 1.6,
  padding: '18px 28px',
};

export const footerTextStyle: CSSProperties = {
  fontSize: '12px',
  lineHeight: 1.6,
  margin: '0 0 6px',
};

export const footerLinkStyle: CSSProperties = {
  color: '#0d9488',
  textDecoration: 'none',
};
