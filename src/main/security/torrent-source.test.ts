import { describe, expect, it, vi } from 'vitest';
import { ApprovedPathError } from './approved-paths';
import { resolveTorrentAddParams } from './torrent-source';

describe('resolveTorrentAddParams', () => {
  it('passes magnet links, URLs and info hashes through without touching the disk', () => {
    const read = vi.fn();
    for (const filename of ['magnet:?xt=urn:btih:abc', 'https://example.com/a.torrent', 'a'.repeat(40)]) {
      const params = { filename, paused: true };
      expect(resolveTorrentAddParams(params, read)).toEqual(params);
    }
    expect(read).not.toHaveBeenCalled();
  });

  it('reads a local path through the approved reader and sends metainfo', () => {
    const read = vi.fn(() => Buffer.from('data'));
    const result = resolveTorrentAddParams({ filename: '/home/u/a.torrent', paused: true }, read);
    expect(read).toHaveBeenCalledWith('/home/u/a.torrent');
    expect(result).toEqual({ paused: true, metainfo: Buffer.from('data').toString('base64') });
  });

  it('refuses an arbitrary local file (the reader rejects unapproved paths)', () => {
    const read = vi.fn(() => {
      throw new ApprovedPathError('File was not selected through a file dialog');
    });
    expect(() => resolveTorrentAddParams({ filename: '/etc/passwd' }, read)).toThrow(ApprovedPathError);
  });

  it('sends Windows paths, UNC paths and file URLs to the approved reader', () => {
    for (const filename of ['C:\\t\\a.torrent', 'c:/t/a.torrent', '\\\\srv\\share\\a.torrent', 'file:///etc/passwd']) {
      const read = vi.fn(() => {
        throw new ApprovedPathError('File was not selected through a file dialog');
      });
      expect(() => resolveTorrentAddParams({ filename }, read), filename).toThrow(ApprovedPathError);
      expect(read).toHaveBeenCalledWith(filename);
    }
  });

  it('passes a relative name through to the daemon without touching the disk', () => {
    const read = vi.fn();
    const params = { filename: 'incoming/a.torrent' };
    expect(resolveTorrentAddParams(params, read)).toBe(params);
    expect(read).not.toHaveBeenCalled();
  });

  it('refuses filename and metainfo together', () => {
    expect(() => resolveTorrentAddParams({ filename: '/a.torrent', metainfo: 'AAAA' }, vi.fn())).toThrow(
      ApprovedPathError,
    );
  });

  it('leaves metainfo-only params untouched', () => {
    const params = { metainfo: 'AAAA' };
    expect(resolveTorrentAddParams(params, vi.fn())).toBe(params);
  });
});
