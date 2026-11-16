import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (jar.value === undefined ? undefined : { value: jar.value }) }),
}));

import { readActiveServer } from './active-session';
import { sealSession } from './session-cookie';

const SECRET = 'current-secret-0123456789-abcdefghij';
const target = {
  host: 'nas.example.com',
  port: 9091,
  path: '/transmission/rpc',
  useSSL: true,
  username: 'alice',
  password: 'hunter2-very-secret',
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('COOKIE_SECRET', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  jar.value = undefined;
});

describe('readActiveServer', () => {
  it('returns null without a cookie', async () => {
    expect(await readActiveServer()).toBeNull();
  });

  it('keeps the self-signed opt-in from the sealed cookie', async () => {
    jar.value = await sealSession({ ...target, allowSelfSigned: true });
    expect(await readActiveServer()).toMatchObject({ ...target, allowSelfSigned: true });
  });

  it('keeps an explicit false opt-in', async () => {
    jar.value = await sealSession({ ...target, allowSelfSigned: false });
    expect((await readActiveServer())?.allowSelfSigned).toBe(false);
  });

  it('leaves the opt-in absent when the cookie has none', async () => {
    jar.value = await sealSession(target);
    expect((await readActiveServer())?.allowSelfSigned).toBeUndefined();
  });
});
