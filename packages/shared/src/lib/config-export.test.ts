import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformApi } from '../platform/api-types';
import { useNotificationStore } from '../stores/notification-store';
import { exportSaveMode, runConfigExport } from './config-export';

const configExport = vi.fn();
const dialogSaveFile = vi.fn();
const electron = { configExport, dialogSaveFile } as unknown as PlatformApi;

beforeEach(() => {
  vi.resetAllMocks();
  useNotificationStore.setState({ notifications: [] });
});

describe('exportSaveMode', () => {
  it('lets main save a secret-bearing export on Electron, the renderer a redacted one, the browser on web', () => {
    expect(exportSaveMode({ dialogSaveFile }, { includePasswords: true })).toBe('main');
    expect(exportSaveMode({ dialogSaveFile }, {})).toBe('native');
    expect(exportSaveMode({}, { includePasswords: true })).toBe('download');
  });
});

describe('runConfigExport', () => {
  it('does not save a file itself when main wrote it (includePasswords)', async () => {
    configExport.mockResolvedValue({ success: true });
    await runConfigExport(electron, { servers: true, includePasswords: true }, 'a.json');
    expect(dialogSaveFile).not.toHaveBeenCalled();
  });

  it('saves the redacted data through the native dialog', async () => {
    configExport.mockResolvedValue({ success: true, data: { servers: [] } });
    dialogSaveFile.mockResolvedValue({ success: true, data: 'x' });
    await runConfigExport(electron, { servers: true }, 'a.json');
    expect(dialogSaveFile).toHaveBeenCalledWith({ defaultPath: 'a.json' }, JSON.stringify({ servers: [] }, null, 2));
  });

  it('is silent when the user declines', async () => {
    configExport.mockResolvedValue({ success: false, code: 'CANCELLED' });
    await runConfigExport(electron, { servers: true, includePasswords: true }, 'a.json');
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
    expect(dialogSaveFile).not.toHaveBeenCalled();
  });

  it('notifies when main fails to write', async () => {
    configExport.mockResolvedValue({ success: false, error: 'Export failed' });
    await runConfigExport(electron, { servers: true, includePasswords: true }, 'a.json');
    expect(JSON.stringify(useNotificationStore.getState())).toContain('notification.exportFailed');
  });
});
