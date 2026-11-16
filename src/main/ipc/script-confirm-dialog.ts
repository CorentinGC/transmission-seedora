import { BrowserWindow, dialog } from 'electron';
import { t } from '../i18n/main-i18n';
import type { ScriptChange } from '../security/script-guard';

const MAX_VALUE_CHARS = 200;

/** Removes control and invisible format characters (bidi overrides, zero-width) and marks truncation with an ellipsis. */
export function sanitizeForDialog(text: string, max = MAX_VALUE_CHARS): string {
  const clean = text.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  const chars = [...clean];
  return chars.length > max ? `${chars.slice(0, max).join('')}\u2026` : clean;
}

/** One `key: value` line for the dialog. */
export function describeChange({ key, value }: ScriptChange): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `${key}: ${sanitizeForDialog(text ?? '')}`;
}

/** Native confirmation (default button: cancel). Resolves true only when the user explicitly allows. */
export async function confirmScriptChanges(
  window: BrowserWindow | null,
  changes: ScriptChange[],
  serverLabel?: string,
): Promise<boolean> {
  const lines = changes.map(describeChange);
  if (serverLabel) lines.unshift(sanitizeForDialog(serverLabel, 120));
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [t('native.scriptGuard.cancel'), t('native.scriptGuard.allow')],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: t('native.scriptGuard.title'),
    message: t('native.scriptGuard.message'),
    detail: t('native.scriptGuard.detail', { changes: lines.join('\n') }),
  };
  const result = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
  return result.response === 1;
}
