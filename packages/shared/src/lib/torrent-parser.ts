/**
 * Minimal bencode decoder + tracker extractor for .torrent files.
 * Only decodes enough to extract announce/announce-list fields.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface BencodeList extends Array<BencodeValue> {}
interface BencodeDict { [key: string]: BencodeValue }
type BencodeValue = string | number | BencodeList | BencodeDict;

function decodeBencode(data: Uint8Array, offset = 0): { value: BencodeValue; offset: number } {
  const byte = data[offset];

  // Integer: i<number>e
  if (byte === 0x69) {
    let end = offset + 1;
    while (data[end] !== 0x65) end++;
    const str = String.fromCharCode(...data.slice(offset + 1, end));
    return { value: parseInt(str, 10), offset: end + 1 };
  }

  // List: l<items>e
  if (byte === 0x6c) {
    const list: BencodeValue[] = [];
    let pos = offset + 1;
    while (data[pos] !== 0x65) {
      const result = decodeBencode(data, pos);
      list.push(result.value);
      pos = result.offset;
    }
    return { value: list, offset: pos + 1 };
  }

  // Dictionary: d<key><value>...e
  if (byte === 0x64) {
    const dict: Record<string, BencodeValue> = {};
    let pos = offset + 1;
    while (data[pos] !== 0x65) {
      const key = decodeBencode(data, pos);
      const val = decodeBencode(data, key.offset);
      dict[key.value as string] = val.value;
      pos = val.offset;
    }
    return { value: dict, offset: pos + 1 };
  }

  // String: <length>:<data>
  let colonIdx = offset;
  while (data[colonIdx] !== 0x3a) colonIdx++;
  const lengthStr = String.fromCharCode(...data.slice(offset, colonIdx));
  const length = parseInt(lengthStr, 10);
  const strBytes = data.slice(colonIdx + 1, colonIdx + 1 + length);
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(strBytes);
    return { value: decoded, offset: colonIdx + 1 + length };
  } catch {
    // Binary data (e.g. info hash) — return hex placeholder
    return { value: '[binary]', offset: colonIdx + 1 + length };
  }
}

/**
 * Extract tracker URLs from a base64-encoded .torrent file.
 */
export function extractTrackersFromBase64(base64: string): string[] {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { value } = decodeBencode(binary);
  const dict = value as Record<string, BencodeValue>;

  const trackers: string[] = [];

  if (typeof dict.announce === 'string') {
    trackers.push(dict.announce);
  }

  if (Array.isArray(dict['announce-list'])) {
    for (const tier of dict['announce-list']) {
      if (Array.isArray(tier)) {
        for (const url of tier) {
          if (typeof url === 'string' && !trackers.includes(url)) {
            trackers.push(url);
          }
        }
      }
    }
  }

  return trackers;
}
