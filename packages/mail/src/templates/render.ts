import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import type { RenderedEmail } from './types';

export const renderEmailElement = async (
  element: ReactElement,
  subject: string
): Promise<RenderedEmail> => {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, subject, text };
};
