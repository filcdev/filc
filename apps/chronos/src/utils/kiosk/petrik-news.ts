import { XMLParser } from 'fast-xml-parser';

/** One petrik.hu article, reduced to what the navigator slideshow needs. */
export type PetrikNewsItem = {
  /** Plain-text excerpt of the article body, or '' when there is none. */
  body: string;
  /** First image in the article body, or null when the article has none. */
  imageUrl: string | null;
  /** Raw RFC822 `<pubDate>` string, exactly as the feed carries it. */
  publishedAt: string;
  title: string;
  /** Absolute article URL, without any `#...` fragment. */
  url: string;
};

const parser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  trimValues: true,
});

const IMG_SRC_RE = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i;

/**
 * Hard safety ceiling on items parsed from a feed, above any selectable
 * `petrikNewsMaxItems` value; the route slices the cached list down to the
 * kiosk's configured count on the way out.
 */
const MAX_PARSED_ITEMS = 30;

/** The ampersand HTML entities WordPress emits in `src` URLs, → `&`. */
const AMP_ENTITY_RE = /&(?:amp|#0?38|#x26);/gi;

/** Cap on the readable excerpt length served to the kiosk. */
const BODY_MAX_CHARS = 400;

const HTML_TAG_RE = /<[^>]*>/g;
const ENTITY_RE = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const TRAILING_SLASH_RE = /\/+$/;

/** The trailing WordPress excerpt marker `[…]`, after `&hellip;` is decoded. */
const EXCERPT_MARKER = '[\u2026]';

/** A tiny safe subset of named HTML entities the feed emits. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '\u2026',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
};

/** The first `<img src>` in a blob of HTML, or null. */
function firstImage(html: unknown): string | null {
  if (typeof html !== 'string' || html.length === 0) {
    return null;
  }
  return html.match(IMG_SRC_RE)?.[1]?.replace(AMP_ENTITY_RE, '&') ?? null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

/** petrik.hu appends utm params as a `#...` fragment; the browser ignores it. */
function stripFragment(link: string): string {
  const hash = link.indexOf('#');
  return hash === -1 ? link : link.slice(0, hash);
}

/**
 * Strip trailing slashes so an RSS item URL and a WordPress REST `link` with
 * different slash styles still compare equal.
 */
export function stripTrailingSlash(url: string): string {
  return url.replace(TRAILING_SLASH_RE, '');
}

/**
 * Decode the numeric/named entities the feed uses, leaving unknown or
 * out-of-range ones untouched so untrusted input can never throw.
 */
function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (match, body: string) => {
    if (!body.startsWith('#')) {
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    }
    const hex = body[1] === 'x' || body[1] === 'X';
    const codePoint = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10_ff_ff
      ? String.fromCodePoint(codePoint)
      : match;
  });
}

/** HTML (or a plain-text excerpt) down to clean, whitespace-collapsed text. */
function toPlainText(html: unknown): string {
  if (typeof html !== 'string' || html.length === 0) {
    return '';
  }
  return decodeEntities(html.replace(HTML_TAG_RE, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cap the excerpt length, cutting at a word boundary and appending `…`. */
function truncateBody(text: string): string {
  if (text.length <= BODY_MAX_CHARS) {
    return text;
  }
  const cut = text.lastIndexOf(' ', BODY_MAX_CHARS);
  return `${text.slice(0, cut > 0 ? cut : BODY_MAX_CHARS).trimEnd()}…`;
}

/** `description` when it has text, else `content:encoded` reduced to text. */
function extractBody(item: Record<string, unknown>): string {
  try {
    const description = toPlainText(item.description);
    const text =
      description.length > 0
        ? description
        : toPlainText(item['content:encoded']);

    const withoutMarker = text.endsWith(EXCERPT_MARKER)
      ? text.slice(0, -EXCERPT_MARKER.length).trim()
      : text;

    return truncateBody(withoutMarker);
  } catch {
    return '';
  }
}

/**
 * Parse a petrik.hu WordPress RSS body into slideshow items. Malformed items
 * are skipped rather than failing the whole feed, and a missing channel or
 * empty feed parses to an empty list.
 */
export function parsePetrikNewsFeed(xml: string): PetrikNewsItem[] {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }

  const channel = (parsed as { rss?: unknown })?.rss as
    | { channel?: unknown }
    | undefined;
  if (!channel?.channel || typeof channel.channel !== 'object') {
    return [];
  }

  const rawItems = (channel.channel as { item?: unknown }).item;
  if (rawItems == null) {
    return [];
  }
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const result: PetrikNewsItem[] = [];
  for (const raw of items) {
    if (raw == null || typeof raw !== 'object') {
      continue;
    }

    const item = raw as Record<string, unknown>;
    const title = asString(item.title);
    const link = asString(item.link);
    if (!(title && link)) {
      continue;
    }

    result.push({
      body: extractBody(item),
      imageUrl:
        firstImage(item['content:encoded']) ?? firstImage(item.description),
      publishedAt: asString(item.pubDate) ?? '',
      title,
      url: stripFragment(link),
    });
  }

  return result.slice(0, MAX_PARSED_ITEMS);
}

/**
 * Extract `[link, sourceUrl]` from one untrusted REST post entry, or null when
 * the entry has no usable featured image (`featured_media: 0`, or a missing
 * `_embedded['wp:featuredmedia'][0].source_url`).
 */
function featuredImageEntry(entry: unknown): [string, string] | null {
  if (entry == null || typeof entry !== 'object') {
    return null;
  }
  const post = entry as Record<string, unknown>;
  if (post.featured_media === 0) {
    return null;
  }

  const link = asString(post.link);
  if (!link) {
    return null;
  }

  const embedded = post._embedded;
  if (embedded == null || typeof embedded !== 'object') {
    return null;
  }
  const featuredMedia = (embedded as Record<string, unknown>)[
    'wp:featuredmedia'
  ];
  if (!Array.isArray(featuredMedia) || featuredMedia.length === 0) {
    return null;
  }
  const sourceUrl = asString(
    (featuredMedia[0] as Record<string, unknown> | null | undefined)?.source_url
  );
  return sourceUrl ? [link, sourceUrl] : null;
}

/**
 * Build a `post link → featured image URL` map from an untrusted WordPress
 * REST `/wp/v2/posts` response. petrik.hu's RSS never carries the featured
 * image, so the kiosk uses the open REST API as a best-effort fallback;
 * malformed entries and posts without a banner (`featured_media: 0`) are
 * skipped rather than failing the whole lookup.
 */
export function parseFeaturedImages(json: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(json)) {
    return map;
  }

  for (const entry of json) {
    const pair = featuredImageEntry(entry);
    if (pair) {
      map.set(stripTrailingSlash(pair[0]), pair[1]);
    }
  }

  return map;
}
