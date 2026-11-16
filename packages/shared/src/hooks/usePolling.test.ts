import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPolling } from './usePolling';

describe('startPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks immediately and on every interval', async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const stop = startPolling(cb, 1000, vi.fn());
    expect(cb).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(cb).toHaveBeenCalledTimes(3);
    stop();
  });

  it('skips a tick while the previous one is in flight', async () => {
    let finish!: () => void;
    const cb = vi.fn(
      () =>
        new Promise<void>((r) => {
          finish = r;
        }),
    );
    const stop = startPolling(cb, 1000, vi.fn());
    await vi.advanceTimersByTimeAsync(3000);
    expect(cb).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb).toHaveBeenCalledTimes(2);
    stop();
  });

  it('reports a rejected callback once per outage and keeps polling', async () => {
    const onError = vi.fn();
    const cb = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('c'));
    const stop = startPolling(cb, 1000, onError);
    await vi.advanceTimersByTimeAsync(3000);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ message: 'a' });
    expect(onError.mock.calls[1]?.[0]).toMatchObject({ message: 'c' });
    stop();
  });

  it('stops ticking after cleanup and ignores a late failure', async () => {
    let fail!: (e: Error) => void;
    const onError = vi.fn();
    const cb = vi.fn(
      () =>
        new Promise<void>((_, rej) => {
          fail = rej;
        }),
    );
    const stop = startPolling(cb, 1000, onError);
    stop();
    fail(new Error('late'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('a restarted poller is not blocked by the previous one still in flight', async () => {
    const cb = vi.fn(() => new Promise<void>(() => {}));
    startPolling(cb, 1000, vi.fn())();
    const stop = startPolling(cb, 1000, vi.fn());
    expect(cb).toHaveBeenCalledTimes(2);
    stop();
  });
});
