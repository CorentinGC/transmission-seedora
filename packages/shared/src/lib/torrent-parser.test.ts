import { describe, expect, it } from 'vitest';
import { extractTrackersFromBase64, MAX_TRACKERS, TorrentParseError } from './torrent-parser';

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

const FIXTURE =
  'd8:announce12:http://a/ann13:announce-listll12:http://a/annel12:http://b/annee' +
  '4:infod6:lengthi12345e4:name3:abc12:piece lengthi16384e6:pieces20:' +
  'abcdefghijklmnopqrst' +
  'ee';

const parse = (s: string) => extractTrackersFromBase64(b64(s));

describe('extractTrackersFromBase64 on malformed input', () => {
  it('parses the full fixture', () => {
    expect(parse(FIXTURE)).toEqual(['http://a/ann', 'http://b/ann']);
  });

  it('terminates quickly with a TorrentParseError at every truncation offset', () => {
    const start = Date.now();
    for (let cut = 0; cut < FIXTURE.length; cut++) {
      let caught: unknown;
      try {
        parse(FIXTURE.slice(0, cut));
      } catch (e) {
        caught = e;
      }
      expect(caught, `cut at ${cut}`).toBeInstanceOf(TorrentParseError);
    }
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it.each([
    ['empty input', ''],
    ['non-bencode garbage', 'hello world, not a torrent'],
    ['binary garbage', '\u0000\u0001ÿþ'],
    ['root is a list', 'l4:spame'],
    ['root is an integer', 'i42e'],
    ['root is a string', '4:spam'],
    ['integer without terminator', 'di1e'],
    ['integer with no digits', 'dd1:ai ee'],
    ['integer with junk', 'd1:ai12xe'],
    ['string length without colon', 'd1:a123'],
    ['string length larger than data', 'd1:a99999999999999999999:xe'],
    ['string length slightly past end', 'd1:a5:abce'],
    ['negative string length', 'd1:a-1:xe'],
    ['empty string length', 'd1::xe'],
    ['list without terminator', 'd1:al1:a'],
    ['dict without terminator', 'd1:ad1:b1:c'],
    ['dict key that is not a string', 'di1e1:ae'],
    ['dict key without a value', 'd1:ae'],
    ['unknown type byte', 'd1:ax1:be'],
  ])('throws TorrentParseError for %s', (_name, input) => {
    expect(() => parse(input)).toThrow(TorrentParseError);
  });

  it('throws TorrentParseError (not a DOMException) for invalid base64', () => {
    expect(() => extractTrackersFromBase64('***not base64***')).toThrow(TorrentParseError);
  });

  it('rejects deeply nested lists without overflowing the stack', () => {
    const depth = 100_000;
    const input = 'd1:a' + 'l'.repeat(depth) + 'e'.repeat(depth) + 'e';
    expect(() => parse(input)).toThrow(TorrentParseError);
  });

  it('rejects deeply nested dicts without overflowing the stack', () => {
    const depth = 100_000;
    const input = 'd' + '1:ad'.repeat(depth) + 'e'.repeat(depth + 1);
    expect(() => parse(input)).toThrow(TorrentParseError);
  });

  it('accepts nesting within the depth limit', () => {
    const depth = 30;
    const input = 'd1:a' + 'l'.repeat(depth) + 'e'.repeat(depth) + '8:announce3:urle';
    expect(parse(input)).toEqual(['url']);
  });

  it('handles a very large string without stack overflow', () => {
    const big = 'x'.repeat(500_000);
    expect(parse(`d8:announce3:url4:blob${big.length}:${big}e`)).toEqual(['url']);
  });

  it('tolerates unsorted and duplicate keys (last wins)', () => {
    expect(parse('d8:announce1:a8:announce1:be')).toEqual(['b']);
    expect(parse('d4:infode8:announce1:ae')).toEqual(['a']);
  });

  it('tolerates trailing bytes after the root dict', () => {
    expect(parse('d8:announce1:aeJUNK')).toEqual(['a']);
  });

  it('does not pollute prototypes through a __proto__ key', () => {
    parse('d9:__proto__d8:announce1:xe8:announce1:ae');
    expect(({} as Record<string, unknown>).announce).toBeUndefined();
  });
});

describe('extractTrackersFromBase64 on a tracker flood', () => {
  it('caps 200k unique announce-list entries at MAX_TRACKERS, quickly and in order', () => {
    const urls = Array.from({ length: 200_000 }, (_, i) => {
      const url = `http://t/${i}`;
      return `${url.length}:${url}`;
    });
    const start = performance.now();
    const result = parse(`d13:announce-listl${`l${urls.join('')}e`}ee`);
    expect(performance.now() - start).toBeLessThan(1000);
    expect(result).toHaveLength(MAX_TRACKERS);
    expect(result[0]).toBe('http://t/0');
    expect(result[MAX_TRACKERS - 1]).toBe(`http://t/${MAX_TRACKERS - 1}`);
  });
});
