import { lookup } from 'node:dns/promises';
import { StatusCodes } from 'http-status-codes';
import { ApiHttpError } from '#utils/http';

const IPV4_OCTET_RE = /^\d{1,3}$/;
const IPV6_HEXTET_RE = /^[0-9a-f]{1,4}$/;
const HOST_BRACKETS_RE = /^\[|\]$/g;

type Ipv4Octets = [number, number, number, number];
type Ipv6Bytes = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Parses a dotted-quad IPv4 literal into its four octets, or null. */
function parseIpv4(address: string): Ipv4Octets | null {
  const parts = address.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!IPV4_OCTET_RE.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets as Ipv4Octets;
}

/** Parses each hextet string into a number; null if any is malformed. */
function parseHextetRun(run: string[]): number[] | null {
  const hextets: number[] = [];
  for (const part of run) {
    if (!IPV6_HEXTET_RE.test(part)) {
      return null;
    }
    hextets.push(Number.parseInt(part, 16));
  }
  return hextets;
}

/** Flattens eight 16-bit hextets into sixteen bytes. */
function toBytes(hextets: number[]): Ipv6Bytes {
  const bytes: number[] = [];
  for (const hextet of hextets) {
    bytes.push(Math.floor(hextet / 256), hextet % 256);
  }
  return bytes as Ipv6Bytes;
}

/**
 * Detach an embedded dotted-quad IPv4 tail (the final 32 bits) from an IPv6
 * address, returning the remaining hextet text plus the tail's two hextets.
 */
function splitIpv4Tail(
  text: string
): { hextets: number[]; text: string } | null {
  const lastDot = text.lastIndexOf('.');
  if (lastDot === -1) {
    return { hextets: [], text };
  }
  const lastColon = text.lastIndexOf(':');
  if (lastColon === -1 || lastColon > lastDot) {
    return null;
  }
  const ipv4 = parseIpv4(text.slice(lastColon + 1));
  if (!ipv4) {
    return null;
  }
  const [o0, o1, o2, o3] = ipv4;
  return {
    hextets: [o0 * 256 + o1, o2 * 256 + o3],
    text: text.slice(0, lastColon),
  };
}

/** Parses an IPv6 literal into its 16 bytes, or null. */
function parseIpv6(address: string): Ipv6Bytes | null {
  const detached = splitIpv4Tail(address.toLowerCase());
  if (!detached) {
    return null;
  }

  const halves = detached.text.split('::');
  if (halves.length > 2) {
    return null;
  }

  const [headPart = '', tailPart = ''] = halves;
  const headText = headPart === '' ? [] : headPart.split(':');
  let tailText: string[] = [];
  if (halves.length === 2 && tailPart !== '') {
    tailText = tailPart.split(':');
  }

  const headHextets = parseHextetRun(headText);
  if (!headHextets) {
    return null;
  }
  const tailHextets = parseHextetRun(tailText);
  if (!tailHextets) {
    return null;
  }

  const total =
    headHextets.length + tailHextets.length + detached.hextets.length;
  const hextets = [...headHextets];
  if (halves.length === 2) {
    if (total >= 8) {
      return null;
    }
    for (let i = total; i < 8; i++) {
      hextets.push(0);
    }
  } else if (total !== 8) {
    return null;
  }
  hextets.push(...tailHextets, ...detached.hextets);

  return toBytes(hextets);
}

/** True when every byte in `[start, end)` is zero. */
function isZeroRange(bytes: number[], start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (bytes[i] !== 0) {
      return false;
    }
  }
  return true;
}

function isPrivateIpv4([a, b, c]: Ipv4Octets): boolean {
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 192 && b === 0 && c === 0) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  return a >= 224;
}

function isPrivateIpv6(bytes: Ipv6Bytes): boolean {
  // Unspecified `::`.
  if (isZeroRange(bytes, 0, 16)) {
    return true;
  }
  // Loopback `::1`.
  if (isZeroRange(bytes, 0, 15) && bytes[15] === 1) {
    return true;
  }
  // IPv4-mapped `::ffff:a.b.c.d`.
  if (isZeroRange(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isPrivateIpv4([bytes[12], bytes[13], bytes[14], bytes[15]]);
  }
  // NAT64 `64:ff9b::/96`: the last 32 bits are an embedded IPv4 literal that
  // can carry a private destination. (6to4/Teredo are deliberately ignored —
  // they encode tunnel endpoints, not the final destination.)
  if (
    isZeroRange(bytes, 4, 12) &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b
  ) {
    return isPrivateIpv4([bytes[12], bytes[13], bytes[14], bytes[15]]);
  }
  // Unique local `fc00::/7`.
  if (bytes[0] >= 0xfc && bytes[0] <= 0xfd) {
    return true;
  }
  // Link local `fe80::/10`.
  if (bytes[0] === 0xfe && bytes[1] >= 0x80 && bytes[1] <= 0xbf) {
    return true;
  }
  return false;
}

/**
 * True when `address` is a literal IP in a private, link-local, multicast or
 * reserved range. Hostnames return false and are left to DNS resolution.
 */
export function isPrivateAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) {
    return isPrivateIpv4(ipv4);
  }
  const ipv6 = parseIpv6(address);
  if (ipv6) {
    return isPrivateIpv6(ipv6);
  }
  return false;
}

const feedNotAllowed = () =>
  new ApiHttpError(StatusCodes.BAD_REQUEST, {
    message: 'Feed URL is not allowed',
  });

/**
 * SSRF protection for the public petrik-news endpoint: only https URLs whose
 * hostname is a public DNS name resolving to non-private addresses may be
 * fetched. Fails closed on any DNS error.
 */
export async function assertAllowedFeedUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw feedNotAllowed();
  }

  if (parsed.protocol !== 'https:') {
    throw feedNotAllowed();
  }

  const hostname = parsed.hostname.replace(HOST_BRACKETS_RE, '');

  // A literal IP (v4 or v6) carries no DNS name to sanity-check; it is
  // evaluated by `isPrivateAddress` below instead of the hostname rules.
  const isIpLiteral =
    parseIpv4(hostname) !== null || parseIpv6(hostname) !== null;

  if (
    !isIpLiteral &&
    (hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      !hostname.includes('.'))
  ) {
    throw feedNotAllowed();
  }

  if (isPrivateAddress(hostname)) {
    throw feedNotAllowed();
  }

  const addresses = await lookup(hostname, { all: true }).catch(() => {
    throw feedNotAllowed();
  });

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw feedNotAllowed();
  }
}
