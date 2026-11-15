import { OutboundError } from './errors';

/**
 * Resource bounds for outbound calls (ADR 0003, "Resource bounds"). All state is in memory and per
 * process: it bounds what one instance can be made to hold, which is what matters for an OOM.
 */

/** Total response bytes buffered by in-flight outbound calls in one process. */
export const MAX_IN_FLIGHT_BYTES = 32 * 1024 * 1024;
/** Concurrent outbound calls towards one destination (same resolved addresses and port). */
export const MAX_CONCURRENT_PER_DESTINATION = 8;
/** Concurrent `getaddrinfo` calls; libuv's pool has 4 threads shared with fs and crypto. */
export const MAX_CONCURRENT_LOOKUPS = 3;
/** Lookups allowed to wait for a slot before new ones are refused. */
export const MAX_QUEUED_LOOKUPS = 64;

/** A global budget of buffered bytes. */
export interface ByteBudget {
  /** Takes `bytes` if they fit; false (and nothing taken) otherwise. */
  reserve(bytes: number): boolean;
  release(bytes: number): void;
  inUse(): number;
}

/** Creates a byte budget of `limit` bytes. */
export function createByteBudget(limit: number): ByteBudget {
  let used = 0;
  return {
    reserve(bytes) {
      if (used + bytes > limit) return false;
      used += bytes;
      return true;
    },
    release(bytes) {
      used = Math.max(0, used - bytes);
    },
    inUse: () => used,
  };
}

/** A per-key concurrency cap without queueing. */
export interface ConcurrencyGate {
  /** Returns a one-shot release function, or null when `key` is at its cap. */
  tryAcquire(key: string): (() => void) | null;
  /** Number of keys currently holding at least one slot. */
  size(): number;
}

/** Creates a gate allowing `max` concurrent holders per key. Keys with no holder are forgotten. */
export function createConcurrencyGate(max: number): ConcurrencyGate {
  const active = new Map<string, number>();
  return {
    tryAcquire(key) {
      const current = active.get(key) ?? 0;
      if (current >= max) return null;
      active.set(key, current + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const left = (active.get(key) ?? 1) - 1;
        if (left <= 0) active.delete(key);
        else active.set(key, left);
      };
    },
    size: () => active.size,
  };
}

/** Runs tasks with bounded concurrency and a bounded wait queue. */
export interface LookupLimiter {
  /**
   * Runs `task` when a slot is free. A slot is held until the task itself settles, even if `signal`
   * aborts first, because the underlying thread cannot be cancelled. Rejects with TIMEOUT when the
   * signal aborts while queued and RATE_LIMITED when the queue is full.
   */
  run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T>;
  active(): number;
  queued(): number;
}

/** Creates a limiter with `maxActive` running tasks and at most `maxQueued` waiting ones. */
export function createLookupLimiter(maxActive: number, maxQueued: number): LookupLimiter {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    const start = queue.shift();
    if (start) start();
  };

  const start = <T>(task: () => Promise<T>): Promise<T> => {
    active += 1;
    const done = () => {
      active -= 1;
      next();
    };
    let promise: Promise<T>;
    try {
      promise = task();
    } catch (error) {
      done();
      return Promise.reject(error);
    }
    return promise.finally(done);
  };

  return {
    run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
      if (signal.aborted) return Promise.reject(new OutboundError('TIMEOUT'));
      if (active < maxActive) return start(task);
      if (queue.length >= maxQueued) return Promise.reject(new OutboundError('RATE_LIMITED'));
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
          const index = queue.indexOf(go);
          if (index >= 0) queue.splice(index, 1);
          reject(new OutboundError('TIMEOUT'));
        };
        const go = () => {
          signal.removeEventListener('abort', onAbort);
          start(task).then(resolve, reject);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        queue.push(go);
      });
    },
    active: () => active,
    queued: () => queue.length,
  };
}
