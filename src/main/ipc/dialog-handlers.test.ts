import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ dialog: {}, BrowserWindow: {}, ipcMain: { handle: vi.fn(), on: vi.fn() } }));

const { directoryApprovalKind, safeJsonFileName } = await import('./dialog-handlers');

describe('safeJsonFileName', () => {
  it('keeps only a sanitized base name with a .json extension', () => {
    expect(safeJsonFileName('seedora-backup.json')).toBe('seedora-backup.json');
    expect(safeJsonFileName('../../etc/passwd')).toBe('passwd.json');
    expect(safeJsonFileName(undefined)).toBe('seedora-export.json');
    expect(safeJsonFileName('..')).toBe('seedora-export.json');
  });
});

describe('directoryApprovalKind', () => {
  it('records a watch-folder approval only when the dialog was opened for it', () => {
    expect(directoryApprovalKind({ purpose: 'watch-folder' })).toBe('watch-folder');
    expect(directoryApprovalKind({})).toBe('directory');
    expect(directoryApprovalKind(undefined)).toBe('directory');
  });
});
