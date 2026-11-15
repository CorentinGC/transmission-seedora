import { OutboundError } from './errors';
import type { LookupLimiter } from './outbound-limits';
import { SHARED_CLIENT_KEY } from './rate-limit';

/**
 * The system DNS resolver with its abuse bounds (ADR 0003, "Request behaviour"). `getaddrinfo`
 * cannot be cancelled and runs on libuv's small thread pool, shared with fs and crypto, so a name
 * that never answers can pin a thread for as long as the system resolver waits.
 */

/** One resolved address. */
export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/**
 * Resolves a host name to all its addresses. Injectable for tests; the default uses the system
 * resolver. `clientKey` identifies the caller for the per-client lookup cap.
 */
export type Resolver = (host: string, signal?: AbortSignal, clientKey?: string) => Promise<ResolvedAddress[]>;

/** Lookups of other names one client may have waiting for its slot; more are refused. */
export const MAX_SLOT_WAITERS_PER_CLIENT = 4;
/** How long a name whose lookup timed out is refused without a new lookup. */
export const NEGATIVE_CACHE_TTL_MS = 30_000;
/** Names remembered by the negative cache; the oldest are forgotten first. */
export const MAX_NEGATIVE_ENTRIES = 1024;
/**
 * A lookup must have really run this long before its timeout counts as a hang. A healthy name
 * whose queued lookup started a moment before its caller's deadline is not a hang.
 */
export const MIN_HANG_MS = 3_000;
type DnsLookup = (host: string, options: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;

/** One lookup in flight for a client; concurrent callers of the same name share it. */
interface Inflight {
  clientKey: string;
  host: string;
  /** Callers still waiting. */
  waiting: number;
  /** When `getaddrinfo` really started (not just queued); null while queued. */
  startedAt: number | null;
  settled: boolean;
  controller: AbortController;
  promise: Promise<ResolvedAddress[]>;
}

/** Injection points for tests. */
export interface SystemResolverOptions {
  now?: () => number;
  negativeTtlMs?: number;
  minHangMs?: number;
}

/**
 * Builds a resolver on `getaddrinfo`, bounded three ways:
 * - lookups run through `limiter` (a global cap and a bounded queue; a slow answer holds its slot
 *   until it really returns, while the waiting call gets TIMEOUT at its deadline);
 * - an identified client holds at most one lookup slot: concurrent calls for the same name share it
 *   (the poll fires several at once), a call for another name waits for the slot until its own
 *   deadline (at most a few waiters, then RATE_LIMITED). With no trusted identity there is no
 *   per-client slot;
 * - a name whose lookup had really run for `MIN_HANG_MS` when its callers gave up is refused for
 *   a short time (DNS_FAILED), so a hanging name cannot be retried into the whole pool. Refusal is per exact name only: a
 *   domain-level rule would let an attacker block a whole public suffix for every user.
 * c-ares was rejected: it ignores /etc/hosts, which LAN self-hosters rely on.
 */
export function createSystemResolver(lookup: DnsLookup, limiter: LookupLimiter, options: SystemResolverOptions = {}): Resolver {
  const { now = Date.now, negativeTtlMs = NEGATIVE_CACHE_TTL_MS, minHangMs = MIN_HANG_MS } = options;
  const inflight = new Map<string, Inflight>();
  const negative = new Map<string, number>();

  const isRefused = (name: string): boolean => {
    const until = negative.get(name);
    if (until === undefined) return false;
    if (now() < until) return true;
    negative.delete(name);
    return false;
  };

  const refuseFor = (name: string): void => {
    negative.delete(name);
    negative.set(name, now() + negativeTtlMs);
    while (negative.size > MAX_NEGATIVE_ENTRIES) {
      const oldest = negative.keys().next();
      if (oldest.done) break;
      negative.delete(oldest.value);
    }
  };

  const begin = (clientKey: string, host: string, name: string): Inflight => {
    const entry: Inflight = {
      clientKey,
      host: name,
      waiting: 0,
      startedAt: null,
      settled: false,
      controller: new AbortController(),
      promise: Promise.resolve([]),
    };
    entry.promise = limiter
      .run(() => {
        entry.startedAt = now();
        return lookup(host, { all: true, verbatim: true });
      }, entry.controller.signal)
      .then((results) => results.map(({ address, family }): ResolvedAddress => ({ address, family: family === 6 ? 6 : 4 })))
      .finally(() => {
        entry.settled = true;
        if (inflight.get(clientKey) === entry) inflight.delete(clientKey);
      });
    // Every caller may have left by the time it settles: that rejection is expected, not unhandled.
    entry.promise.catch(() => undefined);
    return entry;
  };

  const wait = (entry: Inflight, signal: AbortSignal): Promise<ResolvedAddress[]> =>
    new Promise((resolve, reject) => {
      entry.waiting += 1;
      const onAbort = () => {
        entry.waiting -= 1;
        if (entry.waiting === 0 && !entry.settled) {
          if (entry.startedAt !== null) {
            if (now() - entry.startedAt >= minHangMs) refuseFor(entry.host);
          } else {
            // Still queued: it will never run, so the client's slot is free right away.
            inflight.delete(entry.clientKey);
          }
          entry.controller.abort();
        }
        reject(new OutboundError('TIMEOUT'));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      entry.promise.then(
        (value) => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });

  /** Resolves when `entry` has settled, either way; TIMEOUT when `signal` aborts first. */
  const settled = (entry: Inflight, signal: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      const onAbort = () => reject(new OutboundError('TIMEOUT'));
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      const done = () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
      entry.promise.then(done, done);
    });

  const slotWaiters = new Map<string, number>();

  return async (host, signal = new AbortController().signal, clientKey) => {
    const name = host.toLowerCase();
    // Without a trusted identity every caller shares one key: a per-client slot would let one
    // name lock out everybody, so only the global limiter and the negative cache apply.
    const key = clientKey === undefined || clientKey === SHARED_CLIENT_KEY ? undefined : clientKey;
    if (key === undefined) {
      if (isRefused(name)) throw new OutboundError('DNS_FAILED');
      return wait(begin(SHARED_CLIENT_KEY, host, name), signal);
    }
    for (;;) {
      if (isRefused(name)) throw new OutboundError('DNS_FAILED');
      const entry = inflight.get(key);
      if (!entry) {
        const created = begin(key, host, name);
        inflight.set(key, created);
        return wait(created, signal);
      }
      if (entry.host === name) return wait(entry, signal);
      // Another name of this client is in flight: wait for its slot until our own deadline.
      const waiting = slotWaiters.get(key) ?? 0;
      if (waiting >= MAX_SLOT_WAITERS_PER_CLIENT) throw new OutboundError('RATE_LIMITED');
      slotWaiters.set(key, waiting + 1);
      try {
        await settled(entry, signal);
      } finally {
        const left = (slotWaiters.get(key) ?? 1) - 1;
        if (left <= 0) slotWaiters.delete(key);
        else slotWaiters.set(key, left);
      }
    }
  };
}
