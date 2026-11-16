import { describe, expect, it, vi } from 'vitest';
import { bindMenuEvents, type MenuEventDeps } from './useMenuEvents';

function setup() {
  const listeners = new Map<string, () => void>();
  const unsubscribe = vi.fn();
  const api = {
    onMenuEvent: vi.fn((channel: string, cb: () => void) => {
      listeners.set(channel, cb);
      return unsubscribe;
    }),
  };
  const deps: MenuEventDeps = {
    selectedIds: () => [4, 5],
    startTorrents: vi.fn(),
    stopTorrents: vi.fn(),
    verifyTorrents: vi.fn(),
    reannounceTorrents: vi.fn(),
    startAll: vi.fn(),
    stopAll: vi.fn(),
    toggleAltSpeed: vi.fn(),
    toggleFilterPanel: vi.fn(),
    toggleDetailsPanel: vi.fn(),
    handlers: () => ({ onAddTorrent: vi.fn() }),
  };
  return { api, listeners, unsubscribe, deps };
}

describe('bindMenuEvents', () => {
  it('subscribes every channel once and unsubscribes all on cleanup', () => {
    const { api, unsubscribe, deps } = setup();
    const cleanup = bindMenuEvents(api, deps);
    expect(api.onMenuEvent).toHaveBeenCalledTimes(14);
    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(14);
  });

  it('reads the selection at event time, not subscription time', () => {
    const { api, listeners, deps } = setup();
    bindMenuEvents(api, deps);
    listeners.get('menu:torrent-start')!();
    expect(deps.startTorrents).toHaveBeenCalledWith([4, 5]);
  });

  it('does nothing for a selection-based action when nothing is selected', () => {
    const { api, listeners, deps } = setup();
    bindMenuEvents(api, { ...deps, selectedIds: () => [] });
    listeners.get('menu:torrent-stop')!();
    expect(deps.stopTorrents).not.toHaveBeenCalled();
  });

  it('calls the latest handlers supplied by the getter', () => {
    const { api, listeners, deps } = setup();
    const first = vi.fn();
    const second = vi.fn();
    let current = { onOpenSettings: first };
    bindMenuEvents(api, { ...deps, handlers: () => current });
    current = { onOpenSettings: second };
    listeners.get('menu:settings')!();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
