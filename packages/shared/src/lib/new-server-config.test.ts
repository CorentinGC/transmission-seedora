import { describe, expect, it } from 'vitest';
import { toNewServerConfig } from './new-server-config';

const base = { name: 'NAS', host: '10.0.0.2', port: 9091, path: '/transmission/rpc', useSSL: false };

describe('toNewServerConfig', () => {
  it('drops the one-shot clear flags, even when undefined (the main process rejects unknown keys)', () => {
    const result = toNewServerConfig({ ...base, clearPassword: undefined, clearProxyPassword: true });
    expect('clearPassword' in result).toBe(false);
    expect('clearProxyPassword' in result).toBe(false);
  });

  it('keeps every other field', () => {
    expect(toNewServerConfig({ ...base, username: 'me', password: 'pw', clearPassword: true })).toEqual({
      ...base,
      username: 'me',
      password: 'pw',
    });
  });
});
