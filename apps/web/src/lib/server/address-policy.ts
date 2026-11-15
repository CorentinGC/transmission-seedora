import { isIP } from 'node:net';

/**
 * Outbound address and port policy (ADR 0003).
 *
 * Classification is fail-closed: anything that cannot be parsed is forbidden.
 * `allowPrivate` only ever upgrades the "private" class; "forbidden" is never overridable.
 */

export type AddressClass = 'forbidden' | 'private' | 'public';

type Cidr4 = readonly [string, number];
type Cidr6 = readonly [string, number];

/** Bytes of an IPv4 address, or null when not a canonical dotted quad. */
function parseIPv4(text: string): number[] | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    bytes.push(value);
  }
  return bytes;
}

/** The 16 bytes of an IPv6 address (any textual form, including `::` and a dotted tail), or null. */
function parseIPv6(text: string): number[] | null {
  if (text.includes('%')) return null;
  let work = text;
  const lastColon = work.lastIndexOf(':');
  const tail = work.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    work = `${work.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = work.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): string[] | null => {
    if (part === '') return [];
    const groups = part.split(':');
    return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g)) ? groups : null;
  };
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (!head || !rest) return null;
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const group of groups) {
    const value = parseInt(group, 16);
    bytes.push(value >> 8, value & 0xff);
  }
  return bytes;
}

function inCidr(bytes: readonly number[], base: readonly number[], bits: number): boolean {
  let remaining = bits;
  for (let i = 0; remaining > 0; i++, remaining -= 8) {
    const mask = remaining >= 8 ? 0xff : (0xff << (8 - remaining)) & 0xff;
    if ((bytes[i] & mask) !== (base[i] & mask)) return false;
  }
  return true;
}

const v4 = (cidrs: readonly Cidr4[]) => cidrs.map(([a, b]) => [parseIPv4(a) as number[], b] as const);
const v6 = (cidrs: readonly Cidr6[]) => cidrs.map(([a, b]) => [parseIPv6(a) as number[], b] as const);

const matches = (bytes: readonly number[], table: ReadonlyArray<readonly [number[], number]>) =>
  table.some(([base, bits]) => inCidr(bytes, base, bits));

const V4_FORBIDDEN = v4([
  ['0.0.0.0', 8],
  ['169.254.169.254', 32],
  ['100.100.100.200', 32],
  ['192.0.0.192', 32],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
  ['192.0.2.0', 24],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['198.18.0.0', 15],
  ['192.0.0.0', 24],
  ['192.88.99.0', 24],
]);

const V4_PRIVATE = v4([
  ['127.0.0.0', 8],
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['169.254.0.0', 16],
]);

const V6_FORBIDDEN = v6([
  ['::', 128],
  ['fd00:ec2::254', 128],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['::', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['2002::', 16],
  ['2001::', 32],
  ['100::', 64],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['fec0::', 10],
]);

const V6_PRIVATE = v6([
  ['::1', 128],
  ['fe80::', 10],
  ['fc00::', 7],
]);

const V6_GLOBAL_UNICAST = v6([['2000::', 3]]);
const V6_IPV4_MAPPED = v6([['::ffff:0:0', 96]]);

function classifyV4(bytes: readonly number[]): AddressClass {
  if (matches(bytes, V4_FORBIDDEN)) return 'forbidden';
  if (matches(bytes, V4_PRIVATE)) return 'private';
  return 'public';
}

function classifyV6(bytes: readonly number[]): AddressClass {
  if (matches(bytes, V6_IPV4_MAPPED)) return classifyV4(bytes.slice(12));
  // Specific entries first: `::1` sits inside `::/96`, metadata inside `fc00::/7`.
  const [loopback] = V6_PRIVATE[0];
  if (inCidr(bytes, loopback, 128)) return 'private';
  if (matches(bytes, V6_FORBIDDEN)) return 'forbidden';
  if (matches(bytes, V6_PRIVATE)) return 'private';
  return matches(bytes, V6_GLOBAL_UNICAST) ? 'public' : 'forbidden';
}

/** Classifies an IP literal (brackets tolerated). Unparseable input is `forbidden`. */
export function classifyAddress(address: string): AddressClass {
  const text = address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address;
  if (text.includes('%')) return 'forbidden';
  const family = isIP(text);
  const bytes = family === 4 ? parseIPv4(text) : family === 6 ? parseIPv6(text) : null;
  if (!bytes) return 'forbidden';
  return family === 4 ? classifyV4(bytes) : classifyV6(bytes);
}

/** True when an outbound connection to `address` is permitted under the given opt-in. */
export function isAddressAllowed(address: string, allowPrivate: boolean): boolean {
  const cls = classifyAddress(address);
  return cls === 'public' || (cls === 'private' && allowPrivate);
}

/**
 * Ports browsers refuse to fetch (WHATWG Fetch "bad ports"), blocking cross-protocol abuse.
 * Source: https://fetch.spec.whatwg.org/#port-blocking
 */
export const BAD_PORTS: ReadonlySet<number> = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
]);

/** True for an integer in 1..65535. */
export function isValidPort(port: unknown): port is number {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
}

/** True when `port` is valid and not on the bad-ports list. */
export function isPortAllowed(port: unknown): port is number {
  return isValidPort(port) && !BAD_PORTS.has(port);
}
