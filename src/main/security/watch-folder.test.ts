import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readWatchedTorrent, validateWatchFolder } from './watch-folder';

let dir: string;
beforeAll(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-watch-')));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('validateWatchFolder', () => {
  it('accepts an existing directory and returns its real path', () => {
    expect(validateWatchFolder(dir)).toBe(dir);
  });

  it('refuses empty, relative, missing, file and root paths', () => {
    const file = path.join(dir, 'f.txt');
    fs.writeFileSync(file, 'x');
    expect(validateWatchFolder(undefined)).toBeNull();
    expect(validateWatchFolder('relative/dir')).toBeNull();
    expect(validateWatchFolder(path.join(dir, 'missing'))).toBeNull();
    expect(validateWatchFolder(file)).toBeNull();
    expect(validateWatchFolder(path.parse(dir).root)).toBeNull();
  });
});

describe('readWatchedTorrent', () => {
  it('reads a regular .torrent file', () => {
    const file = path.join(dir, 'a.TORRENT');
    fs.writeFileSync(file, 'abc');
    expect(readWatchedTorrent(file)?.toString()).toBe('abc');
  });

  it('skips symlinks, other extensions and directories', () => {
    const target = path.join(dir, 'target.torrent');
    fs.writeFileSync(target, 'abc');
    const link = path.join(dir, 'link.torrent');
    fs.symlinkSync(target, link);
    const txt = path.join(dir, 'b.txt');
    fs.writeFileSync(txt, 'abc');
    const sub = path.join(dir, 'sub.torrent');
    fs.mkdirSync(sub);
    expect(readWatchedTorrent(link)).toBeNull();
    expect(readWatchedTorrent(txt)).toBeNull();
    expect(readWatchedTorrent(sub)).toBeNull();
  });

  it('refuses a file over the 10 MB cap', () => {
    const big = path.join(dir, 'big.torrent');
    fs.writeFileSync(big, Buffer.alloc(10_000_001));
    expect(() => readWatchedTorrent(big)).toThrow('too large');
  });
});
