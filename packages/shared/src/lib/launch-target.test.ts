import { describe, expect, it, vi } from 'vitest';
import { isLaunchTarget, resolveLaunchTarget } from './launch-target';

describe('isLaunchTarget', () => {
  it('accepts well-formed targets only', () => {
    expect(isLaunchTarget({ kind: 'magnet', uri: 'magnet:?xt=urn:btih:abc' })).toBe(true);
    expect(isLaunchTarget({ kind: 'torrent-file', filePath: '/tmp/a.torrent' })).toBe(true);
    expect(isLaunchTarget({ kind: 'magnet', uri: '' })).toBe(false);
    expect(isLaunchTarget({ kind: 'torrent-file' })).toBe(false);
    expect(isLaunchTarget({ kind: 'other', uri: 'x' })).toBe(false);
    expect(isLaunchTarget(null)).toBe(false);
    expect(isLaunchTarget('magnet:')).toBe(false);
  });
});

describe('resolveLaunchTarget', () => {
  it('maps a magnet to the url mode without reading anything', async () => {
    const read = vi.fn();
    expect(await resolveLaunchTarget({ kind: 'magnet', uri: 'magnet:?x' }, read)).toEqual({
      mode: 'url',
      url: 'magnet:?x',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('reads a torrent file and maps it to the file mode', async () => {
    const read = vi.fn().mockResolvedValue({ success: true, data: 'QUJD' });
    expect(await resolveLaunchTarget({ kind: 'torrent-file', filePath: '/a.torrent' }, read)).toEqual({
      mode: 'file',
      filePath: '/a.torrent',
      fileBase64: 'QUJD',
    });
    expect(read).toHaveBeenCalledWith('/a.torrent');
  });

  it('resolves null when the file cannot be read', async () => {
    expect(
      await resolveLaunchTarget(
        { kind: 'torrent-file', filePath: '/a' },
        vi.fn().mockResolvedValue({ success: false }),
      ),
    ).toBeNull();
    expect(
      await resolveLaunchTarget({ kind: 'torrent-file', filePath: '/a' }, vi.fn().mockRejectedValue(new Error('x'))),
    ).toBeNull();
  });
});
