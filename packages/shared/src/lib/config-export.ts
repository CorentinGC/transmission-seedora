import type { PlatformApi } from '../platform/api-types';
import { guardedCall } from './guarded-call';

type ExportOptions = Parameters<PlatformApi['configExport']>[0];

/** Triggers a browser download of `data` as a JSON file (web only). */
function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Where an export response is saved. A secret-bearing export on a host with native dialogs is written by
 * the main process itself (no data crosses to the renderer); otherwise the renderer saves the returned data.
 */
export function exportSaveMode(
  api: Pick<PlatformApi, 'dialogSaveFile'>,
  options: ExportOptions,
): 'main' | 'native' | 'download' {
  if (!api.dialogSaveFile) return 'download';
  return options.includePasswords ? 'main' : 'native';
}

/**
 * Runs a config export and saves the result: native dialog on Electron, download on web.
 * With `includePasswords` on Electron, main shows its own confirmation and save dialog and returns no data.
 * Failures are notified; a declined export (`CANCELLED`) is silent.
 */
export async function runConfigExport(api: PlatformApi, options: ExportOptions, filename: string): Promise<void> {
  const mode = exportSaveMode(api, options);
  const res = await guardedCall(() => api.configExport(options), 'notification.exportFailed');
  if (!res || mode === 'main' || res.data === undefined || res.data === null) return;
  if (mode === 'download' || !api.dialogSaveFile) {
    downloadJson(res.data, filename);
    return;
  }
  const saveFile = api.dialogSaveFile.bind(api);
  const content = JSON.stringify(res.data, null, 2);
  await guardedCall(() => saveFile({ defaultPath: filename }, content), 'notification.exportFailed');
}
