import type { PlatformApi } from './api-types';

let _api: PlatformApi | null = null;

export function initPlatformApi(api: PlatformApi): void {
  _api = api;
}

export function getPlatformApi(): PlatformApi {
  if (!_api) throw new Error('PlatformApi not initialized. Call initPlatformApi() first.');
  return _api;
}
