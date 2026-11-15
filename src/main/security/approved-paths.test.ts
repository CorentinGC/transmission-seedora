import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApprovedPaths, ApprovedPathError, readRegularFile } from './approved-paths';

let dir: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-approved-'));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (name: string, content = 'x') => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
};
const rules = { kind: 'torrent', extensions: ['.torrent'], maxBytes: 10 } as const;

describe('ApprovedPaths', () => {
  it('refuses a path that no dialog returned', () => {
    const file = write('a.torrent');
    expect(() => new ApprovedPaths().read(file, rules)).toThrow(ApprovedPathError);
  });

  it('reads an approved file', () => {
    const file = write('b.torrent', 'abc');
    const reg = new ApprovedPaths();
    reg.approve([file], 'torrent');
    expect(reg.read(file, rules).toString()).toBe('abc');
  });

  it('refuses an approval of another kind', () => {
    const file = write('c.torrent');
    const reg = new ApprovedPaths();
    reg.approve([file], 'json');
    expect(() => reg.read(file, rules)).toThrow(ApprovedPathError);
  });

  it('refuses an unexpected extension, even when approved', () => {
    const file = write('d.txt');
    const reg = new ApprovedPaths();
    reg.approve([file], 'torrent');
    expect(() => reg.read(file, rules)).toThrow('Unexpected file type');
  });

  it('refuses an oversized file', () => {
    const file = write('e.torrent', 'x'.repeat(11));
    const reg = new ApprovedPaths();
    reg.approve([file], 'torrent');
    expect(() => reg.read(file, rules)).toThrow('too large');
  });

  it('refuses a directory', () => {
    const sub = path.join(dir, 'f.torrent');
    fs.mkdirSync(sub);
    const reg = new ApprovedPaths();
    reg.approve([sub], 'torrent');
    expect(() => reg.read(sub, rules)).toThrow('Not a regular file');
  });

  it('does not follow a symlink to an unapproved target', () => {
    const target = write('secret.torrent');
    const link = path.join(dir, 'link.torrent');
    fs.symlinkSync(target, link);
    const reg = new ApprovedPaths();
    reg.approve([link], 'torrent');
    expect(reg.isApproved(target, 'torrent')).toBe(true); // approval is by real path
    expect(reg.isApproved(path.join(dir, 'other.torrent'), 'torrent')).toBe(false);
  });

  it('bounds the number of approvals', () => {
    const reg = new ApprovedPaths();
    const first = path.join(dir, 'first.torrent');
    reg.approve([first], 'torrent');
    for (let i = 0; i < 300; i++) reg.approve([path.join(dir, `n${i}.torrent`)], 'torrent');
    expect(reg.isApproved(first, 'torrent')).toBe(false);
  });
});

describe('ApprovedPaths.read hardening', () => {
  it('refuses a file swapped for a symlink after the path was resolved', () => {
    const real = write('swap.torrent', 'abc');
    const other = write('swap-target.torrent', 'zzz');
    const reg = new ApprovedPaths();
    reg.approve([real], 'torrent');
    fs.rmSync(real);
    fs.symlinkSync(other, real);
    // Simulate the swap happening right after the path was canonicalised.
    const spy = vi.spyOn(fs, 'realpathSync').mockReturnValue(real);
    try {
      expect(() => reg.read(real, rules)).toThrow(ApprovedPathError);
    } finally {
      spy.mockRestore();
    }
  });

  it('readRegularFile refuses a directory and a symlink', () => {
    const target = write('rr-target.torrent', 'abc');
    const link = path.join(dir, 'rr-link.torrent');
    fs.symlinkSync(target, link);
    expect(() => readRegularFile(link, 10)).toThrow(ApprovedPathError);
    expect(() => readRegularFile(dir, 10)).toThrow(ApprovedPathError);
    expect(readRegularFile(target, 10).toString()).toBe('abc');
  });
});
