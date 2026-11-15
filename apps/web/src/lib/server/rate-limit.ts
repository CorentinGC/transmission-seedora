import { isIP } from 'node:net';

/**
 * In-process token-bucket rate limiter (ADR 0004 section 6).
 *
 * State lives in memory, so limits are per server instance and best effort on
 * serverless hosts: they bound a single client hammering a warm instance, not
 * a distributed attacker. The platform rule (c07.18) is the real global limit.
 */

/** Sustained rate and burst size of one bucket. */
export interface BucketLimit {
  perMinute: number;
  burst: number;
}

/** Limits from ADR 0004. Constants: tune once real traffic is known. */
export const RATE_LIMITS = {
  rpcClient: { perMinute: 900, burst: 150 },
  rpcDestination: { perMinute: 1800, burst: 300 },
  testConnection: { perMinute: 10, burst: 5 },
  setActiveServer: { perMinute: 30, burst: 10 },
  geoip: { perMinute: 60, burst: 20 },
} as const satisfies Record<string, BucketLimit>;

/** Key used by buckets when no trustworthy client identity exists. */
export const SHARED_CLIENT_KEY = 'shared';

/** Maximum number of tracked keys per bucket. */
export const MAX_TRACKED_KEYS = 10_000;

export interface TokenBucketOptions extends BucketLimit {
  /** Maximum tracked keys; least recently used keys are forgotten first. */
  maxKeys?: number;
  /** Injectable clock, milliseconds. */
  now?: () => number;
}

export interface TokenBucket {
  /** Consumes one token for `key`; false when the key is over its limit. */
  take(key: string): boolean;
  /** Drops buckets that have fully refilled (they carry no information). */
  sweep(): void;
  /** Number of tracked keys. */
  size(): number;
}

interface BucketState {
  tokens: number;
  updatedAt: number;
}

/** Creates a token bucket keyed by string, with an LRU bound on memory. */
export function createTokenBucket(options: TokenBucketOptions): TokenBucket {
  const { perMinute, burst, maxKeys = MAX_TRACKED_KEYS, now = Date.now } = options;
  if (!(perMinute > 0) || !(burst > 0) || !(maxKeys > 0)) {
    throw new Error('Invalid rate limit configuration');
  }
  const perMs = perMinute / 60_000;
  // Map iteration order is insertion order: delete + set marks a key most recently used.
  const states = new Map<string, BucketState>();

  const refilled = (state: BucketState, at: number): number => {
    const elapsed = Math.max(0, at - state.updatedAt);
    return Math.min(burst, state.tokens + elapsed * perMs);
  };

  return {
    take(key) {
      const at = now();
      const previous = states.get(key);
      const available = previous ? refilled(previous, at) : burst;
      const allowed = available >= 1;
      states.delete(key);
      // A clock that went backwards must not credit tokens: keep the later timestamp.
      const updatedAt = previous ? Math.max(previous.updatedAt, at) : at;
      states.set(key, { tokens: allowed ? available - 1 : available, updatedAt });
      while (states.size > maxKeys) {
        const oldest = states.keys().next();
        if (oldest.done) break;
        states.delete(oldest.value);
      }
      return allowed;
    },
    sweep() {
      const at = now();
      for (const [key, state] of states) {
        if (refilled(state, at) >= burst) states.delete(key);
      }
    },
    size: () => states.size,
  };
}

/** Minimal header reader, satisfied by `Headers` and by test doubles. */
export interface HeaderReader {
  get(name: string): string | null;
}

export interface ClientKeyOptions {
  /** True when running on Vercel (`VERCEL=1`). */
  onVercel: boolean;
  /** `SEEDORA_TRUST_PROXY_HEADERS=true`: a reverse proxy we control sets the header. */
  trustProxy: boolean;
}

/**
 * Derives the rate-limit key of the calling client, or null when there is no
 * trustworthy identity (the per-client bucket is then skipped, ADR 0004).
 *
 * On Vercel the platform sets `x-vercel-forwarded-for` and overwrites
 * `x-forwarded-for` rather than appending to a caller-supplied value. Elsewhere
 * the headers are caller-controlled, so they are used only when a trusted
 * proxy is declared. The last entry is the one our proxy appended.
 */
export function clientKey(headers: HeaderReader, options: ClientKeyOptions): string | null {
  if (!options.onVercel && !options.trustProxy) return null;
  const raw = options.onVercel
    ? (headers.get('x-vercel-forwarded-for') ?? headers.get('x-forwarded-for'))
    : headers.get('x-forwarded-for');
  if (!raw || raw.length > 1024) return null;
  const last = raw.split(',').pop()?.trim() ?? '';
  return isIP(last) ? last.toLowerCase() : null;
}
