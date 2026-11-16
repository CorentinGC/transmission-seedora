import type { PlatformApi } from './api-types';

/**
 * True on the web build. The web host has no native file dialogs, so the absence of
 * `dialogSaveFile` is the capability check; no host-specific import is needed.
 */
export function isWebPlatform(api: PlatformApi): boolean {
  return api.dialogSaveFile === undefined;
}
