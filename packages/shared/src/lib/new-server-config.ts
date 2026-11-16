import type { NewServerConfig, ServerConfigPatch } from '../types';

/**
 * Narrows a form payload to a `NewServerConfig`: the one-shot `clearPassword` / `clearProxyPassword` flags only
 * make sense for an update, and the Electron main process rejects unknown keys (even ones set to `undefined`).
 */
export function toNewServerConfig(config: NewServerConfig & ServerConfigPatch): NewServerConfig {
  const { clearPassword: _clearPassword, clearProxyPassword: _clearProxyPassword, ...fields } = config;
  return fields;
}
