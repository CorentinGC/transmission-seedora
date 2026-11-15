import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPreferences, getServers, setPreferences } from './web-storage';

function installFakeLocalStorage(): Map<string, string> {
  const data = new Map<string, string>();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
  return data;
}

describe('web-storage', () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = installFakeLocalStorage();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns defaults when nothing is stored', () => {
    expect(getServers()).toEqual([]);
    expect(getPreferences().pollingInterval).toBe(5000);
  });

  it('merges partial preference updates over existing ones', () => {
    setPreferences({ theme: 'dark' });
    setPreferences({ pollingInterval: 1000 });
    expect(getPreferences()).toMatchObject({ theme: 'dark', pollingInterval: 1000 });
  });

  it('falls back to defaults on corrupted JSON', () => {
    data.set('seedora:servers', '{not json');
    expect(getServers()).toEqual([]);
  });
});
