import { beforeAll, describe, expect, it, vi } from 'vitest';

const built = vi.hoisted(() => ({
  template: [] as Array<{ label?: string; submenu?: Array<Record<string, unknown>> }>,
}));
vi.mock('electron', () => ({
  app: { isPackaged: true },
  shell: { openExternal: vi.fn() },
  Menu: {
    buildFromTemplate: (template: typeof built.template) => {
      built.template = template;
      return {};
    },
    setApplicationMenu: vi.fn(),
  },
}));

const { shell } = await import('electron');
const { createMenu } = await import('./menu');
const { setLanguage } = await import('./i18n/main-i18n');

const items = () => built.template.flatMap((m) => m.submenu ?? []);

beforeAll(() => createMenu({ webContents: { send: vi.fn() } } as never));

describe('application menu', () => {
  it('has no Delete or bare Backspace accelerator (it would capture typing in inputs)', () => {
    const accelerators = items()
      .map((i) => i.accelerator)
      .filter(Boolean);
    expect(accelerators).not.toContain('Delete');
    expect(accelerators).not.toContain('Backspace');
  });

  it('uses no accelerator twice and avoids the macOS Minimize shortcut', () => {
    const accelerators = items()
      .map((i) => i.accelerator)
      .filter((a): a is string => typeof a === 'string');
    expect(new Set(accelerators).size).toBe(accelerators.length);
    expect(accelerators).not.toContain('CmdOrCtrl+M');
  });

  it('points the issue link at this repository', () => {
    const report = items().find((i) => i.label === 'Report an Issue');
    (report?.click as () => void)();
    expect(shell.openExternal).toHaveBeenCalledWith('https://github.com/CorentinGC/transmission-seedora/issues');
  });
});

describe('application menu (packaging and language)', () => {
  const allItems = (): Array<Record<string, unknown>> =>
    built.template.flatMap((m) => [m, ...(m.submenu ?? [])] as Array<Record<string, unknown>>);

  it('has no DevTools item in a packaged build', () => {
    createMenu({ webContents: { send: vi.fn() } } as never);
    expect(allItems().some((i) => i.role === 'toggleDevTools')).toBe(false);
  });

  it('translates every label (no raw key is ever shown) and follows the language', () => {
    const labels = () =>
      allItems()
        .map((i) => i.label)
        .filter((l): l is string => typeof l === 'string');
    createMenu({ webContents: { send: vi.fn() } } as never);
    const english = labels();
    expect(english.some((l) => l.startsWith('native.'))).toBe(false);
    expect(english).toContain('File');

    setLanguage('fr');
    createMenu({ webContents: { send: vi.fn() } } as never);
    const french = labels();
    expect(french).not.toContain('File');
    expect(french.some((l) => l.startsWith('native.'))).toBe(false);
    expect(french).toHaveLength(english.length);
    setLanguage('en');
  });
});
