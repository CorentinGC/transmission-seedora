import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEffectHarness } from './effect-harness';
import type { LaunchTarget } from '../types';

const harness = vi.hoisted(() => ({
  current: null as null | ReturnType<typeof import('./effect-harness').createEffectHarness>,
}));
const apiRef = vi.hoisted(() => ({ api: null as unknown }));

vi.mock('react', async (importActual) => ({
  ...(await importActual<typeof import('react')>()),
  useEffect: (e: () => void | (() => void)) => harness.current!.useEffect(e),
  useRef: <T>(v: T) => harness.current!.useRef(v),
}));
vi.mock('../platform/api-context', () => ({ useApi: () => apiRef.api }));
vi.mock('i18next', () => ({ default: { t: (k: string) => k, language: 'en' } }));

const { useLaunchTargets } = await import('./useLaunchTargets');
// Called outside a component on purpose: effects are driven by the harness, not by React.
const runHook = useLaunchTargets;
const { useNotificationStore } = await import('../stores/notification-store');

type Listener = (payload: unknown) => void;

function setup(opts: { pending?: LaunchTarget[]; files?: Record<string, string>; pullFails?: boolean } = {}) {
  const listeners = new Map<string, Listener>();
  const unsubscribe = vi.fn();
  const order: string[] = [];
  const api = {
    onMenuEvent: vi.fn((channel: string, cb: Listener) => {
      order.push('subscribe');
      listeners.set(channel, cb);
      return unsubscribe;
    }),
    launchTargetsTake: vi.fn(async () => {
      order.push('pull');
      return opts.pullFails
        ? { success: false as const, error: 'x' }
        : { success: true as const, data: opts.pending ?? [] };
    }),
    readFileBase64: vi.fn(async (p: string) =>
      p in (opts.files ?? {})
        ? { success: true as const, data: opts.files![p] }
        : { success: false as const, error: 'nope' },
    ),
  };
  apiRef.api = api;
  const onTarget = vi.fn();
  const render = (cb = onTarget) => {
    harness.current!.beginRender();
    runHook(cb);
    return harness.current!.commit();
  };
  return { api, listeners, unsubscribe, order, onTarget, render };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const notifications = () => useNotificationStore.getState().notifications.map((n) => n.messageKey);

beforeEach(() => {
  harness.current = createEffectHarness();
  useNotificationStore.setState({ notifications: [] });
});

describe('useLaunchTargets', () => {
  it('subscribes before pulling so nothing in between is lost', () => {
    const { order, render } = setup();
    render();
    expect(order).toEqual(['subscribe', 'pull']);
  });

  it('opens the dialog for a pending magnet and a pending torrent file', async () => {
    const { onTarget, render } = setup({
      pending: [
        { kind: 'magnet', uri: 'magnet:?xt=urn:btih:a' },
        { kind: 'torrent-file', filePath: '/t/a.torrent' },
      ],
      files: { '/t/a.torrent': 'QUJD' },
    });
    render();
    await flush();
    expect(onTarget).toHaveBeenCalledWith({ mode: 'url', url: 'magnet:?xt=urn:btih:a' });
    expect(onTarget).toHaveBeenCalledWith({ mode: 'file', filePath: '/t/a.torrent', fileBase64: 'QUJD' });
  });

  it('handles targets pushed later through the launch:target event', async () => {
    const { listeners, onTarget, render } = setup();
    render();
    listeners.get('launch:target')!({ kind: 'magnet', uri: 'magnet:?x' });
    await flush();
    expect(onTarget).toHaveBeenCalledWith({ mode: 'url', url: 'magnet:?x' });
  });

  it('ignores malformed payloads from the event channel and the pull (hostile input)', async () => {
    const { listeners, onTarget, render } = setup({
      pending: [{ kind: 'magnet', uri: '' } as LaunchTarget, { kind: 'other' } as unknown as LaunchTarget],
    });
    render();
    for (const bad of [null, 'magnet:?x', 42, { kind: 'torrent-file' }, { kind: 'magnet', uri: 7 }])
      listeners.get('launch:target')!(bad);
    await flush();
    expect(onTarget).not.toHaveBeenCalled();
    expect(notifications()).toEqual([]);
  });

  it('notifies when a torrent file cannot be read and does not open the dialog', async () => {
    const { onTarget, render } = setup({ pending: [{ kind: 'torrent-file', filePath: '/missing.torrent' }] });
    render();
    await flush();
    expect(onTarget).not.toHaveBeenCalled();
    expect(notifications()).toEqual(['notification.fileReadFailed']);
  });

  it('surfaces a failed pull as a notification', async () => {
    const { render } = setup({ pullFails: true });
    render();
    await flush();
    expect(notifications()).toEqual(['notification.launchFailed']);
  });

  it('drops a result that resolves after unmount and unsubscribes', async () => {
    const { listeners, onTarget, unsubscribe, render } = setup({
      pending: [{ kind: 'torrent-file', filePath: '/t/a.torrent' }],
      files: { '/t/a.torrent': 'QUJD' },
    });
    const unmount = render();
    listeners.get('launch:target')!({ kind: 'magnet', uri: 'magnet:?late' });
    unmount();
    await flush();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(onTarget).not.toHaveBeenCalled();
  });

  it('calls the latest callback, not the one from the first render', async () => {
    const { listeners, onTarget, render } = setup();
    render();
    const newer = vi.fn();
    render(newer);
    listeners.get('launch:target')!({ kind: 'magnet', uri: 'magnet:?y' });
    await flush();
    expect(newer).toHaveBeenCalledWith({ mode: 'url', url: 'magnet:?y' });
    expect(onTarget).not.toHaveBeenCalled();
  });

  it('is inert on hosts without launch support (web)', () => {
    const { api, render } = setup();
    delete (api as Partial<typeof api>).launchTargetsTake;
    render();
    expect(api.onMenuEvent).not.toHaveBeenCalled();
  });

  it('does nothing when the host has no readFileBase64', () => {
    const { api, render } = setup();
    delete (api as Partial<typeof api>).readFileBase64;
    render();
    expect(api.launchTargetsTake).not.toHaveBeenCalled();
  });
});
