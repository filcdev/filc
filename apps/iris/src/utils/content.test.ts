import { describe, expect, it } from 'bun:test';
import { contentToText, textToContent } from './content';

const BLOCKS = [{ content: 'Hello', type: 'text' }];

describe('contentToText', () => {
  it('reads a legacy flat string and a block array alike', () => {
    expect(contentToText('Hello')).toBe('Hello');
    expect(contentToText(BLOCKS)).toBe('Hello');
    expect(
      contentToText([
        { content: 'Hello', type: 'text' },
        { content: { text: 'world' }, type: 'paragraph' },
      ])
    ).toBe('Hello\nworld');
  });
});

describe('textToContent', () => {
  it('keeps the stored block array when its text did not change', () => {
    expect(textToContent(contentToText(BLOCKS), BLOCKS)).toBe(BLOCKS);
  });

  it('leaves an unchanged legacy string out of the request', () => {
    expect(textToContent('Régi leírás', 'Régi leírás')).toBeUndefined();
  });

  it('rebuilds one text block when the text changed', () => {
    expect(textToContent('New', 'Old')).toEqual([
      { content: 'New', type: 'text' },
    ]);
    expect(textToContent('New', BLOCKS)).toEqual([
      { content: 'New', type: 'text' },
    ]);
  });

  it('builds blocks for a new event, which has no stored description', () => {
    expect(textToContent('', undefined)).toEqual([
      { content: '', type: 'text' },
    ]);
  });
});
