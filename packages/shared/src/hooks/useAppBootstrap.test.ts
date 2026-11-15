import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEffectHarness } from './effect-harness';
import type { ServerConfig } from '../types/server';

const harness = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import('./effect-harness').createEffectHarness> }));
const world = vi.hoisted(() => ({
  api: null as unknown,
  serverState: {} as Record<string, unknown>,
  uiState: {} as Record<string, unknown>,
  language: 'en',
  changeLanguage: (() => undefined) as (...args: unknown[]) => unknown,
  applyTheme: (() => undefined) as (...args: unknown[]) => unknown,
  uiSetState: (() => undefined) as (...args: unknown[]) => unknown,
}));

vi.mock('react', async (importActual) => ({
  ...(await importActual<typeof import('react')>()),
  useEffect: (e: () => void | (() => void)) => harness.current!.useEffect(e),
}));
vi.mock('../platform/api-context', () => ({ useApi: () => world.api }));
vi.mock('../stores/server-store', () => ({
  useServerStore: (sel: (s: Record<string, unknown>) => unknown) => sel(world.serverState),
}));
vi.mock('../stores/ui-store', () => ({
  useUiStore: Object.assign((sel: (s: Record<string, unknown>) => unknown) => sel(world.uiState), {
    setState: (...a: unknown[]) => world.uiSetState(...a),
  }),
}));
vi.mock('i18next', () => ({
  default: {
    get language() {
      return world.language;
    },
    changeLanguage: (...a: unknown[]) => world.changeLanguage(...a),
    t: (k: string) => k,
  },
}));
vi.mock('./useApplyTheme', () => ({ useApplyTheme: () => world.applyTheme() }));

const { useAppBootstrap } = await import('./useAppBootstrap');
// Called outside a component on purpose: effects are driven by the harness, not by React.
const runHook = useAppBootstrap;
const { useNotificationStore } = await import('../stores/notification-store');

const server = (id: string): ServerConfig => ({ id, name: id, host: 'h', port: 9091, path: '/transmission/rpc', useSSL: false });
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { servers?: ServerConfig[]; activeServerId?: string | null; prefs?: unknown; prefsThrows?: boolean } = {}) {
  const actions = {
    fetchServers: vi.fn(),
    setActiveServer: vi.fn(),
    setTheme: vi.fn(),
    setPollingInterval: vi.fn(),
    setRelativeDates: vi.fn(),
  };
  world.serverState = {
    servers: opts.servers ?? [],
    activeServerId: opts.activeServerId ?? null,
    fetchServers: actions.fetchServers,
    setActiveServer: actions.setActiveServer,
  };
  world.uiState = { setTheme: actions.setTheme, setPollingInterval: actions.setPollingInterval, setRelativeDates: actions.setRelativeDates };
  world.api = {
    prefsGet: vi.fn(async () => {
      if (opts.prefsThrows) throw new Error('boom');
      return opts.prefs === undefined ? { success: false as const, error: 'x' } : { success: true as const, data: opts.prefs };
    }),
  };
  const render = (pick?: (s: readonly ServerConfig[]) => string | null) => {
    harness.current!.beginRender();
    runHook(pick);
    return harness.current!.commit();
  };
  return { actions, render };
}

beforeEach(() => {
  harness.current = createEffectHarness();
  world.language = 'en';
  world.changeLanguage = vi.fn();
  world.applyTheme = vi.fn();
  world.uiSetState = vi.fn();
  useNotificationStore.setState({ notifications: [] });
});

describe('useAppBootstrap: preferences', () => {
  it('loads servers, applies theme/interval/dates/language and the stored layout', async () => {
    const { actions, render } = setup({
      prefs: {
        theme: 'dark', pollingInterval: 5000, relativeDates: true, language: 'fr',
        columnVisibility: { name: false }, columnSizing: { name: 120 }, columnOrder: ['name', 'size'], speedPresets: [1, 2],
      },
    });
    render();
    await flush();
    expect(actions.fetchServers).toHaveBeenCalledTimes(1);
    expect(actions.setTheme).toHaveBeenCalledWith('dark');
    expect(actions.setPollingInterval).toHaveBeenCalledWith(5000);
    expect(actions.setRelativeDates).toHaveBeenCalledWith(true);
    expect(world.changeLanguage).toHaveBeenCalledWith('fr');
    expect(world.uiSetState).toHaveBeenCalledWith({
      columnVisibility: { name: false }, columnSizing: { name: 120 }, columnOrder: ['name', 'size'], speedPresets: [1, 2],
    });
    expect(world.applyTheme).toHaveBeenCalled();
  });

  it('does not touch the language when it already matches, and skips empty layout state', async () => {
    const { render } = setup({
      prefs: { theme: 'light', pollingInterval: 1000, relativeDates: false, language: 'en', columnVisibility: {}, columnSizing: {}, columnOrder: [] },
    });
    render();
    await flush();
    expect(world.changeLanguage).not.toHaveBeenCalled();
    expect(world.uiSetState).not.toHaveBeenCalled();
  });

  it('reports a failed preferences load once and leaves the UI state alone', async () => {
    const { actions, render } = setup({});
    render();
    await flush();
    expect(useNotificationStore.getState().notifications.map((n) => n.messageKey)).toEqual(['notification.prefsLoadFailed']);
    expect(actions.setTheme).not.toHaveBeenCalled();
  });

  it('reports a throwing preferences call instead of an unhandled rejection', async () => {
    const { render } = setup({ prefsThrows: true });
    render();
    await flush();
    expect(useNotificationStore.getState().notifications.map((n) => n.messageKey)).toEqual(['notification.prefsLoadFailed']);
  });
});

describe('useAppBootstrap: initial server', () => {
  it('reconnects to the first server by default', () => {
    const { actions, render } = setup({ servers: [server('a'), server('b')] });
    render();
    expect(actions.setActiveServer).toHaveBeenCalledWith('a');
  });

  it('uses the injected picker', () => {
    const { actions, render } = setup({ servers: [server('a'), server('b')] });
    render(() => 'b');
    expect(actions.setActiveServer).toHaveBeenCalledWith('b');
  });

  it('does nothing with no server (empty list) or when the picker declines', () => {
    const empty = setup({ servers: [] });
    empty.render();
    expect(empty.actions.setActiveServer).not.toHaveBeenCalled();
    const declined = setup({ servers: [server('a')] });
    declined.render(() => null);
    expect(declined.actions.setActiveServer).not.toHaveBeenCalled();
  });

  it('never overrides a server that is already active', () => {
    const { actions, render } = setup({ servers: [server('a'), server('b')], activeServerId: 'b' });
    render();
    expect(actions.setActiveServer).not.toHaveBeenCalled();
  });
});
