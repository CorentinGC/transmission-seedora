import fs from 'node:fs';
import path from 'node:path';
import { dialog, BrowserWindow, type FileFilter, type IpcMainInvokeEvent, type OpenDialogOptions } from 'electron';
import { z } from 'zod';
import { IPC } from '@ipc/ipc-channels';
import type { IpcResponse } from '@shared/types';
import { approvedPaths, ApprovedPathError, type ApprovalKind } from '../security/approved-paths';
import { handleGuarded, type SenderValidator } from '../security/ipc-guard';
import { openDirectoryRequestSchema, openFileRequestSchema, resolveOpenPreset, saveFileArgsSchema, type OpenPreset } from '../security/schemas';
import { readApprovedTorrent } from '../security/torrent-source';

const OPEN_PRESETS: Record<OpenPreset, { kind: ApprovalKind; filters: FileFilter[] }> = {
  torrent: { kind: 'torrent', filters: [{ name: 'Torrent Files', extensions: ['torrent'] }] },
  json: { kind: 'json', filters: [{ name: 'JSON', extensions: ['json'] }] },
};

/** Builds a safe default file name (basename only, `.json`) from renderer input. */
export function safeJsonFileName(defaultPath: string | undefined): string {
  const base = path.basename(defaultPath ?? '').replace(/[^A-Za-z0-9._ -]/g, '-');
  const stem = base.replace(/\.json$/i, '').replace(/^\.+/, '');
  return `${stem || 'seedora-export'}.json`;
}

/** Approval kind recorded for a folder picked in the directory dialog: `watch-folder` only when asked for. */
export function directoryApprovalKind(request: z.infer<typeof openDirectoryRequestSchema>): ApprovalKind {
  return request?.purpose === 'watch-folder' ? 'watch-folder' : 'directory';
}

function parentWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

async function showOpen(event: IpcMainInvokeEvent, options: OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  const win = parentWindow(event);
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
}

/** Registers the native dialog channels and the approved-file reader. */
export function registerDialogHandlers(isTrusted: SenderValidator): void {
  handleGuarded(isTrusted, IPC.DIALOG_OPEN_FILE, z.tuple([openFileRequestSchema]), async (event, [request]): Promise<IpcResponse<string[]>> => {
    const preset = OPEN_PRESETS[resolveOpenPreset(request)];
    const result = await showOpen(event, { properties: ['openFile'], filters: preset.filters });
    if (result.canceled) return { success: true, data: [] };
    approvedPaths.approve(result.filePaths, preset.kind);
    return { success: true, data: result.filePaths };
  });

  handleGuarded(isTrusted, IPC.DIALOG_OPEN_DIRECTORY, z.tuple([openDirectoryRequestSchema]), async (event, [request]): Promise<IpcResponse<string | null>> => {
    const result = await showOpen(event, { properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return { success: true, data: null };
    approvedPaths.approve(result.filePaths, directoryApprovalKind(request));
    return { success: true, data: result.filePaths[0] };
  });

  handleGuarded(isTrusted, IPC.DIALOG_SAVE_FILE, saveFileArgsSchema, async (event, [options, content]): Promise<IpcResponse<string | null>> => {
    const win = parentWindow(event);
    const saveOptions = { defaultPath: safeJsonFileName(options.defaultPath), filters: OPEN_PRESETS.json.filters };
    const result = win ? await dialog.showSaveDialog(win, saveOptions) : await dialog.showSaveDialog(saveOptions);
    if (result.canceled || !result.filePath) return { success: true, data: null };
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, data: result.filePath };
  });

  handleGuarded(isTrusted, IPC.READ_FILE_BASE64, z.tuple([z.string().min(1).max(4096)]), (_e, [filePath]): IpcResponse<string> => {
    try {
      return { success: true, data: readApprovedTorrent(filePath).toString('base64') };
    } catch (err) {
      return { success: false, error: err instanceof ApprovedPathError ? err.message : 'Failed to read file' };
    }
  });
}
