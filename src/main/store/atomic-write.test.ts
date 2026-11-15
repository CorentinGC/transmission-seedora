import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileAtomic } from './atomic-write';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seedora-atomic-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeFileAtomic', () => {
  it('replaces the content and leaves no temp file', () => {
    const file = path.join(dir, 'sub', 'c.json');
    writeFileAtomic(file, 'one');
    writeFileAtomic(file, 'two');
    expect(fs.readFileSync(file, 'utf-8')).toBe('two');
    expect(fs.readdirSync(path.dirname(file))).toEqual(['c.json']);
  });

  it('keeps the old file and removes the temp file when the rename fails', () => {
    const file = path.join(dir, 'c.json');
    writeFileAtomic(file, 'old');
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('EXDEV');
    });
    expect(() => writeFileAtomic(file, 'new')).toThrow('EXDEV');
    expect(fs.readFileSync(file, 'utf-8')).toBe('old');
    expect(fs.readdirSync(dir)).toEqual(['c.json']);
  });

  it('keeps the old file and removes the temp file when the write fails', () => {
    const file = path.join(dir, 'c.json');
    writeFileAtomic(file, 'old');
    vi.spyOn(fs, 'fsyncSync').mockImplementation(() => {
      throw new Error('ENOSPC');
    });
    expect(() => writeFileAtomic(file, 'new')).toThrow('ENOSPC');
    expect(fs.readFileSync(file, 'utf-8')).toBe('old');
    expect(fs.readdirSync(dir)).toEqual(['c.json']);
  });
});
