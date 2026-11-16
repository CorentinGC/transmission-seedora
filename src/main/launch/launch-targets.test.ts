import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseLaunchArg, parseLaunchArgs } from './launch-targets';

const HASH = 'c12fe1c06bba254a9dc9f519b335aa7c1367a88a';

describe('parseLaunchArg', () => {
  it('accepts a well-formed magnet link', () => {
    const uri = `magnet:?xt=urn:btih:${HASH}&dn=Ubuntu&tr=udp%3A%2F%2Ftracker.example%3A1337`;
    expect(parseLaunchArg(uri, '/')).toEqual({ kind: 'magnet', uri });
    expect(parseLaunchArg(`MAGNET:?dn=x&xt=urn:btmh:1220${HASH}`, '/')).toMatchObject({ kind: 'magnet' });
  });

  it('rejects malformed, oversized or control-character magnet links', () => {
    expect(parseLaunchArg('magnet:?dn=no-hash', '/')).toBeNull();
    expect(parseLaunchArg('magnet:', '/')).toBeNull();
    expect(parseLaunchArg(`magnet:?xt=urn:btih:${HASH}\u0000`, '/')).toBeNull();
    expect(parseLaunchArg(`magnet:?xt=urn:btih:${HASH} --evil`, '/')).toBeNull();
    expect(parseLaunchArg(`magnet:?xt=urn:btih:${HASH}&dn=${'a'.repeat(9000)}`, '/')).toBeNull();
  });

  it('accepts .torrent paths (absolute, relative to the launch directory, file: URLs, any case)', () => {
    const cwd = path.resolve('/work dir');
    expect(parseLaunchArg(path.resolve('/tmp/a b/é.torrent'), cwd)).toEqual({
      kind: 'torrent-file',
      filePath: path.resolve('/tmp/a b/é.torrent'),
    });
    expect(parseLaunchArg('rel/x.TORRENT', cwd)).toEqual({
      kind: 'torrent-file',
      filePath: path.join(cwd, 'rel/x.TORRENT'),
    });
    expect(parseLaunchArg('file:///tmp/a%20b/x.torrent', cwd)).toEqual({
      kind: 'torrent-file',
      filePath: path.resolve('/tmp/a b/x.torrent'),
    });
  });

  it('ignores flags, other files, other schemes and non-strings', () => {
    for (const arg of [
      '--inspect=9229',
      '-x.torrent',
      '/tmp/notes.txt',
      '/tmp/a.torrent.exe',
      'https://example.com/a.torrent',
      'file://evil.example/share/a.torrent',
      '.',
      '/tmp/a\n.torrent',
    ]) {
      expect(parseLaunchArg(arg, '/')).toBeNull();
    }
    expect(parseLaunchArg(undefined as unknown as string, '/')).toBeNull();
  });
});

describe('parseLaunchArgs', () => {
  it('keeps only valid targets, in order', () => {
    const argv = ['/Applications/Seedora', '--flag', '/a.torrent', 'junk', `magnet:?xt=urn:btih:${HASH}`];
    expect(parseLaunchArgs(argv, '/').map((t) => t.kind)).toEqual(['torrent-file', 'magnet']);
  });
});

describe('Windows network and device paths', () => {
  const original = process.platform;
  afterEach(() => Object.defineProperty(process, 'platform', { value: original }));

  it.each(['\\\\srv\\share\\a.torrent', '\\\\?\\C:\\a.torrent', '//srv/share/a.torrent', '\\\\.\\pipe\\a.torrent'])(
    'rejects %s on win32',
    (arg) => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(parseLaunchArg(arg, 'C:\\')).toBeNull();
    },
  );

  it('keeps accepting a local absolute path on posix', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(parseLaunchArg('/tmp/a.torrent', '/')).toEqual({ kind: 'torrent-file', filePath: '/tmp/a.torrent' });
  });
});
