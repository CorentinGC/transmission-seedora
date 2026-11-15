/**
 * Minimal bencode decoder + tracker extractor for .torrent files.
 * Only decodes enough to extract announce/announce-list fields.
 */

type BencodeList = BencodeValue[];
interface BencodeDict { [key: string]: BencodeValue }
type BencodeValue = string | number | BencodeList | BencodeDict;

/** Maximum list/dict nesting accepted; real .torrent files nest ~5 levels. */
const MAX_DEPTH = 64;
/** Longest integer literal or string-length prefix accepted, in characters. */
const MAX_NUMBER_CHARS = 20;

/** Most trackers extracted from one .torrent; bounds work on crafted announce-lists. */
export const MAX_TRACKERS = 1000;

const CHAR_I = 0x69;
const CHAR_L = 0x6c;
const CHAR_D = 0x64;
const CHAR_E = 0x65;
const CHAR_COLON = 0x3a;
const CHAR_0 = 0x30;
const CHAR_9 = 0x39;
const CHAR_MINUS = 0x2d;

/** Thrown when a .torrent file (or its base64 wrapper) is not valid bencode. */
export class TorrentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TorrentParseError';
  }
}

interface Decoded<T> { value: T; offset: number }

const isDigit = (byte: number | undefined): boolean =>
  byte !== undefined && byte >= CHAR_0 && byte <= CHAR_9;

const utf8 = new TextDecoder('utf-8', { fatal: true });

function decodeInteger(data: Uint8Array, offset: number): Decoded<number> {
  const start = offset + 1;
  const limit = Math.min(data.length, start + MAX_NUMBER_CHARS + 1);
  let end = start;
  while (end < limit && data[end] !== CHAR_E) end++;
  if (end >= data.length || data[end] !== CHAR_E) {
    throw new TorrentParseError(`Unterminated integer at byte ${offset}`);
  }
  let digitsStart = start;
  if (data[digitsStart] === CHAR_MINUS) digitsStart++;
  if (digitsStart === end) throw new TorrentParseError(`Empty integer at byte ${offset}`);
  for (let i = digitsStart; i < end; i++) {
    if (!isDigit(data[i])) throw new TorrentParseError(`Invalid integer at byte ${offset}`);
  }
  let text = '';
  for (let i = start; i < end; i++) text += String.fromCharCode(data[i]);
  return { value: Number(text), offset: end + 1 };
}

function decodeString(data: Uint8Array, offset: number): Decoded<string> {
  const limit = Math.min(data.length, offset + MAX_NUMBER_CHARS + 1);
  let colon = offset;
  while (colon < limit && isDigit(data[colon])) colon++;
  if (colon === offset || data[colon] !== CHAR_COLON) {
    throw new TorrentParseError(`Invalid string length at byte ${offset}`);
  }
  let text = '';
  for (let i = offset; i < colon; i++) text += String.fromCharCode(data[i]);
  const length = Number(text);
  const bodyStart = colon + 1;
  if (!Number.isSafeInteger(length) || length > data.length - bodyStart) {
    throw new TorrentParseError(`String at byte ${offset} exceeds the data length`);
  }
  const bodyEnd = bodyStart + length;
  try {
    return { value: utf8.decode(data.subarray(bodyStart, bodyEnd)), offset: bodyEnd };
  } catch {
    // Binary data (e.g. piece hashes) is not text; keep a placeholder.
    return { value: '[binary]', offset: bodyEnd };
  }
}

function decodeBencode(data: Uint8Array, offset: number, depth: number): Decoded<BencodeValue> {
  if (offset >= data.length) throw new TorrentParseError('Unexpected end of data');
  const byte = data[offset];

  if (byte === CHAR_I) return decodeInteger(data, offset);

  if (byte === CHAR_L || byte === CHAR_D) {
    if (depth >= MAX_DEPTH) throw new TorrentParseError('Nesting is too deep');
    return byte === CHAR_L ? decodeList(data, offset, depth) : decodeDict(data, offset, depth);
  }

  if (isDigit(byte)) return decodeString(data, offset);

  throw new TorrentParseError(`Unexpected byte 0x${byte.toString(16)} at byte ${offset}`);
}

function decodeList(data: Uint8Array, offset: number, depth: number): Decoded<BencodeList> {
  const list: BencodeList = [];
  let pos = offset + 1;
  while (pos < data.length && data[pos] !== CHAR_E) {
    const item = decodeBencode(data, pos, depth + 1);
    list.push(item.value);
    pos = item.offset;
  }
  if (pos >= data.length) throw new TorrentParseError(`Unterminated list at byte ${offset}`);
  return { value: list, offset: pos + 1 };
}

function decodeDict(data: Uint8Array, offset: number, depth: number): Decoded<BencodeDict> {
  // Null prototype so a "__proto__" key is plain data. Unsorted and duplicate keys are tolerated (last wins).
  const dict: BencodeDict = Object.create(null);
  let pos = offset + 1;
  while (pos < data.length && data[pos] !== CHAR_E) {
    const key = decodeString(data, pos);
    const val = decodeBencode(data, key.offset, depth + 1);
    dict[key.value] = val.value;
    pos = val.offset;
  }
  if (pos >= data.length) throw new TorrentParseError(`Unterminated dictionary at byte ${offset}`);
  return { value: dict, offset: pos + 1 };
}

function base64ToBytes(base64: string): Uint8Array {
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    throw new TorrentParseError('Invalid base64 data');
  }
}

/**
 * Extract tracker URLs from a base64-encoded .torrent file.
 * @throws {TorrentParseError} when the input is not valid bencode.
 */
export function extractTrackersFromBase64(base64: string): string[] {
  const binary = base64ToBytes(base64);
  if (binary[0] !== CHAR_D) throw new TorrentParseError('A .torrent file must start with a dictionary');
  const dict = decodeBencode(binary, 0, 0).value as BencodeDict;

  const trackers = new Set<string>();

  if (typeof dict.announce === 'string') {
    trackers.add(dict.announce);
  }

  if (Array.isArray(dict['announce-list'])) {
    for (const tier of dict['announce-list']) {
      if (!Array.isArray(tier)) continue;
      for (const url of tier) {
        if (trackers.size >= MAX_TRACKERS) return [...trackers];
        if (typeof url === 'string') trackers.add(url);
      }
    }
  }

  return [...trackers];
}
