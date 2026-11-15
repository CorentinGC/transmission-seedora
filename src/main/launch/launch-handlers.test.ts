import { beforeEach, describe, expect, it, vi } from 'vitest';

const appEvents = new Map<string, (...args: unknown[]) => void>();
const takeHandler = vi.hoisted(() => ({ fn: undefined as undefined | (() => { data: unknown[] }) }));
vi.mock('electron', () => ({ app: { on: (name: string, fn: (...args: unknown[]) => void) => appEvents.set(name, fn) } }));
vi.mock('../security/ipc-guard', () => ({
  handleGuarded: (_trust: unknown, _channel: string, _schema: unknown, fn: () => { data: unknown[] }) => {
    takeHandler.fn = fn;
  },
}));

const { approvedPaths } = await import('../security/approved-paths');
const { registerLaunchHandling } = await import('./launch-handlers');

const fakeWindow = (destroyed = false) => ({
  isDestroyed: () => destroyed,
  isMinimized: () => false,
  restore: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  webContents: { send: vi.fn() },
});
type FakeWindow = ReturnType<typeof fakeWindow>;
const asWindow = (w: FakeWindow | null) => w as unknown as Parameters<typeof registerLaunchHandling>[1] extends () => infer R ? R : never;
const magnetUri = 'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567';

beforeEach(() => {
  appEvents.clear();
  vi.restoreAllMocks();
});

describe('registerLaunchHandling', () => {
  it('approves a .torrent from argv and delivers it once the renderer pulls', () => {
    const approve = vi.spyOn(approvedPaths, 'approve');
    const win = fakeWindow();
    const launch = registerLaunchHandling(() => true, () => asWindow(win));
    launch.handleArgv(['--flag', '/tmp/a.torrent', 'notes.txt', 'https://x/y.torrent'], '/tmp');
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith(['/tmp/a.torrent'], 'torrent');
    expect(win.show).toHaveBeenCalled();
    expect(takeHandler.fn?.().data).toEqual([{ kind: 'torrent-file', filePath: '/tmp/a.torrent' }]);
  });

  it('open-url accepts magnets only, open-file accepts .torrent only', () => {
    const win = fakeWindow();
    registerLaunchHandling(() => true, () => asWindow(win));
    const preventDefault = vi.fn();
    appEvents.get('open-url')?.({ preventDefault }, 'https://evil.example/x.torrent');
    appEvents.get('open-url')?.({ preventDefault }, magnetUri);
    appEvents.get('open-file')?.({ preventDefault }, '/tmp/readme.txt');
    appEvents.get('open-file')?.({ preventDefault }, '/tmp/b.torrent');
    expect(preventDefault).toHaveBeenCalledTimes(4);
    expect(takeHandler.fn?.().data).toEqual([
      { kind: 'magnet', uri: magnetUri },
      { kind: 'torrent-file', filePath: '/tmp/b.torrent' },
    ]);
  });

  it('keeps the target when the window was destroyed and re-creates the window', () => {
    const dead = fakeWindow(true);
    const fresh = fakeWindow();
    let current: FakeWindow | null = dead;
    const launch = registerLaunchHandling(
      () => true,
      () => asWindow(current),
      () => {
        current = fresh;
        return asWindow(current);
      },
    );
    takeHandler.fn?.(); // renderer was ready on the old window
    appEvents.get('open-url')?.({ preventDefault: vi.fn() }, magnetUri);
    expect(dead.webContents.send).not.toHaveBeenCalled();
    expect(fresh.show).toHaveBeenCalled();
    launch.resetRenderer();
    expect(takeHandler.fn?.().data).toEqual([{ kind: 'magnet', uri: magnetUri }]);
  });

  it('does not throw when there is no window at all', () => {
    const launch = registerLaunchHandling(() => true, () => null);
    takeHandler.fn?.();
    expect(() => appEvents.get('open-url')?.({ preventDefault: vi.fn() }, magnetUri)).not.toThrow();
    launch.resetRenderer();
    expect(takeHandler.fn?.().data).toHaveLength(1);
  });
});
