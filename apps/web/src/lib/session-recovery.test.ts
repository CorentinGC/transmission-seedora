import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ activeId: 'a' as string | null, servers: [] as Record<string, unknown>[] }));
const setCookie = vi.hoisted(() => ({ fn: vi.fn() }));

vi.mock('./web-storage', () => ({
  getActiveServerId: () => storage.activeId,
  getServers: () => storage.servers,
}));
vi.mock('./server-actions/session', () => ({ setActiveServerCookie: setCookie.fn }));

import { RESEAL_COOLDOWN_MS, resetSessionRecovery, withSessionRecovery } from './session-recovery';

const noSession = { success: false, error: 'No active server configured', code: 'NO_SESSION' };

beforeEach(() => {
  resetSessionRecovery();
  vi.useRealTimers();
  storage.activeId = 'a';
  storage.servers = [{ id: 'a', host: 'nas.example.com', port: 9091, path: '', useSSL: false }];
  setCookie.fn.mockReset().mockResolvedValue({ success: true });
});

describe('withSessionRecovery', () => {
  it('re-seals from the stored active server and retries once on NO_SESSION', async () => {
    const call = vi.fn().mockResolvedValueOnce(noSession).mockResolvedValueOnce({ success: true, data: 1 });
    expect(await withSessionRecovery(call)).toEqual({ success: true, data: 1 });
    expect(setCookie.fn).toHaveBeenCalledWith({ host: 'nas.example.com', port: 9091, path: '/transmission/rpc', useSSL: false, username: undefined, password: undefined });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('retries only once and reports SESSION_UNAVAILABLE when the session is still missing after a re-seal', async () => {
    const call = vi.fn().mockResolvedValue(noSession);
    expect(await withSessionRecovery(call)).toMatchObject({ success: false, code: 'SESSION_UNAVAILABLE' });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('stops re-sealing for the cool-down after such a failure, then resumes', async () => {
    vi.useFakeTimers();
    const call = vi.fn().mockResolvedValue(noSession);
    await withSessionRecovery(call);
    expect(setCookie.fn).toHaveBeenCalledTimes(1);
    call.mockClear();
    expect(await withSessionRecovery(call)).toMatchObject({ code: 'SESSION_UNAVAILABLE' });
    expect(setCookie.fn).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RESEAL_COOLDOWN_MS + 1);
    await withSessionRecovery(call);
    expect(setCookie.fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors or successes', async () => {
    const call = vi.fn().mockResolvedValue({ success: false, code: 'TIMEOUT' });
    await withSessionRecovery(call);
    expect(call).toHaveBeenCalledTimes(1);
    expect(setCookie.fn).not.toHaveBeenCalled();
  });

  it('returns the original error when there is no stored active server', async () => {
    storage.activeId = null;
    const call = vi.fn().mockResolvedValue(noSession);
    expect(await withSessionRecovery(call)).toEqual(noSession);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('returns the re-seal failure itself, not NO_SESSION, and does not retry the call', async () => {
    const failed = { success: false, error: 'Too many requests, try again shortly', code: 'RATE_LIMITED' };
    setCookie.fn.mockResolvedValue(failed);
    const call = vi.fn().mockResolvedValue(noSession);
    expect(await withSessionRecovery(call)).toEqual(failed);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('seals the new active server when the active id changed while the cookie was being written', async () => {
    storage.servers = [
      { id: 'a', host: 'old.example.com', port: 1, path: '', useSSL: false },
      { id: 'b', host: 'new.example.com', port: 2, path: '', useSSL: false },
    ];
    setCookie.fn.mockImplementationOnce(async () => {
      storage.activeId = 'b';
      return { success: true };
    });
    const call = vi.fn().mockResolvedValueOnce(noSession).mockResolvedValueOnce({ success: true });
    await withSessionRecovery(call);
    expect(setCookie.fn.mock.calls.map(([t]) => (t as { host: string }).host)).toEqual(['old.example.com', 'new.example.com']);
  });

  it('shares one re-seal between concurrent calls', async () => {
    const make = () => vi.fn().mockResolvedValueOnce(noSession).mockResolvedValueOnce({ success: true });
    await Promise.all([withSessionRecovery(make()), withSessionRecovery(make()), withSessionRecovery(make())]);
    expect(setCookie.fn).toHaveBeenCalledTimes(1);
  });
});
