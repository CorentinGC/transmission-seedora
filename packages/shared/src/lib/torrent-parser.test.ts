import { describe, expect, it } from 'vitest';
import { extractTrackersFromBase64 } from './torrent-parser';

const b64 = (s: string) => btoa(s);

describe('extractTrackersFromBase64', () => {
  it('returns announce and de-duplicated announce-list trackers', () => {
    const torrent =
      'd8:announce12:http://a/ann13:announce-listll12:http://a/annel12:http://b/anneeee';
    expect(extractTrackersFromBase64(b64(torrent))).toEqual(['http://a/ann', 'http://b/ann']);
  });

  it('returns an empty list when there is no tracker', () => {
    expect(extractTrackersFromBase64(b64('d4:infod4:name1:xee'))).toEqual([]);
  });
});
