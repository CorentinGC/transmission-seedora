import { OutboundError } from './errors';
import { canonicalClientKey } from './rate-limit';

/**
 * Resource bounds for outbound calls (ADR 0003, "Request behaviour"). All state is in memory and per
 * process: it bounds what one instance can be made to hold, which is what matters for an OOM.
 */

/** Total response bytes buffered by in-flight outbound calls in one process. */
export const MAX_IN_FLIGHT_BYTES = 32 * 1024 * 1024;
/** One destination may hold at most 1/N of the global byte budget, so one daemon cannot starve the rest. */
export const DESTINATION_BUDGET_FRACTION = 4;
/** Concurrent outbound calls towards one resolved address. */
export const MAX_CONCURRENT_PER_DESTINATION = 8;
/** Concurrent `getaddrinfo` calls; libuv's pool has 4 threads shared with fs and crypto. */
export const MAX_CONCURRENT_LOOKUPS = 3;
/** Lookups allowed to wait for a slot before new ones are refused. */
export const MAX_QUEUED_LOOKUPS = 64;

/**
 * Identity of a destination for limits: the address itself, IPv4-mapped IPv6 as its IPv4 form and
 * any other IPv6 address as its /64 (one subscriber's allocation), so rotating the interface id,
 * or listing extra addresses next to a victim's, gains nothing. Same canonical form as client keys.
 */
export function destinationKey(address: string): string {
  return canonicalClientKey(address) ?? address.toLowerCase();
}

/** The distinct destination keys of a set of resolved addresses. */
export function destinationKeys(addresses: readonly { address: string }[]): string[] {
  return [...new Set(addresses.map((a) => destinationKey(a.address)))];
}

/** A global budget of buffered bytes, with a smaller share per destination key. */
export interface ByteBudget {
  /**
   * Takes `bytes` against the global budget and against each of `keys` if all of them fit; false
   * (and nothing taken) otherwise.
   */
  reserve(bytes: number, keys?: readonly string[]): boolean;
  /** Returns `bytes` previously reserved with the same `keys`. */
  release(bytes: number, keys?: readonly string[]): void;
  inUse(): number;
  /** Bytes currently held by one destination key. */
  inUseBy(key: string): number;
}

/** Creates a byte budget of `limit` bytes where one key may hold at most `perKeyLimit` (default a quarter). */
export function createByteBudget(limit: number, perKeyLimit = Math.floor(limit / DESTINATION_BUDGET_FRACTION)): ByteBudget {
  let used = 0;
  const byKey = new Map<string, number>();
  return {
    reserve(bytes, keys = []) {
      if (used + bytes > limit) return false;
      if (keys.some((key) => (byKey.get(key) ?? 0) + bytes > perKeyLimit)) return false;
      used += bytes;
      for (const key of keys) byKey.set(key, (byKey.get(key) ?? 0) + bytes);
      return true;
    },
    release(bytes, keys = []) {
      used = Math.max(0, used - bytes);
      for (const key of keys) {
        const left = (byKey.get(key) ?? 0) - bytes;
        if (left <= 0) byKey.delete(key);
        else byKey.set(key, left);
      }
    },
    inUse: () => used,
    inUseBy: (key) => byKey.get(key) ?? 0,
  };
}

/** A per-key concurrency cap without queueing. */
export interface ConcurrencyGate {
  /** Returns a one-shot release function, or null when `key` is at its cap. */
  tryAcquire(key: string): (() => void) | null;
  /** Takes one slot on every key, or none: null when any key is at its cap. */
  tryAcquireAll(keys: readonly string[]): (() => void) | null;
  /** Number of keys currently holding at least one slot. */
  size(): number;
}

/** Creates a gate allowing `max` concurrent holders per key. Keys with no holder are forgotten. */
export function createConcurrencyGate(max: number): ConcurrencyGate {
  const active = new Map<string, number>();
  const gate: ConcurrencyGate = {
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
    tryAcquireAll(keys) {
      const releases: Array<() => void> = [];
      for (const key of new Set(keys)) {
        const release = gate.tryAcquire(key);
        if (!release) {
          releases.forEach((undo) => undo());
          return null;
        }
        releases.push(release);
      }
      return () => releases.forEach((release) => release());
    },
    size: () => active.size,
  };
  return gate;
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
