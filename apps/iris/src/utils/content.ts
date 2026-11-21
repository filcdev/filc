import type { EventPayload } from '@/hooks/events';

/** One editor block, as the rich-text columns store it. */
const blockText = (block: unknown): string => {
  if (typeof block === 'string') {
    return block;
  }
  const content = (block as { content?: unknown } | null)?.content;
  if (typeof content === 'string') {
    return content;
  }
  const text = (content as { text?: unknown } | null)?.text;
  return typeof text === 'string' ? text : '';
};

/**
 * The readable text of a rich-text payload. Rows written before the block
 * editor hold a flat string; later ones hold blocks whose content is either a
 * string or a `{ text }` paragraph. Both shapes are what the organizer's
 * textarea and the public page show.
 */
export const contentToText = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content.map(blockText).filter(Boolean).join('\n');
};

/**
 * The write side of the same helper. The editor is one textarea, so an edited
 * description becomes a single text block; an untouched one keeps the original
 * block array instead of being flattened on every save.
 *
 * A row written before the block editor holds a flat string, and the write
 * schema takes blocks only — there is no shape that re-sends it unchanged.
 * Writing nothing is what leaves it alone, so an untouched legacy string
 * answers `undefined` for the caller to leave out of the request.
 */
export function textToContent(
  text: string,
  original: null | undefined
): EventPayload['description'];
export function textToContent(
  text: string,
  original: unknown
): EventPayload['description'] | undefined;
export function textToContent(
  text: string,
  original: unknown
): EventPayload['description'] | undefined {
  if (contentToText(original) === text) {
    if (typeof original === 'string') {
      return undefined;
    }
    if (Array.isArray(original)) {
      return original as EventPayload['description'];
    }
  }
  return [{ content: text, type: 'text' }];
}
