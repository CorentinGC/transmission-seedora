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

  it('loads preferences stored before confirmOnAdd and pathMappings were dropped, without those keys (e2c)', () => {
    data.set(
      'seedora:preferences',
      JSON.stringify({ theme: 'dark', confirmOnAdd: false, pathMappings: [{ remote: '/a', local: '/b' }] }),
    );
    const prefs = getPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs).not.toHaveProperty('confirmOnAdd');
    expect(prefs).not.toHaveProperty('pathMappings');
    setPreferences({ pollingInterval: 1000 });
    expect(JSON.parse(data.get('seedora:preferences')!)).not.toHaveProperty('pathMappings');
  });
});
