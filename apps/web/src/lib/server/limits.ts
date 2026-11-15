import { headers } from 'next/headers';
import { getTrustProxyHeaders } from './env';
import { destinationKeys } from './outbound-limits';
import { OutboundError } from './errors';
import type { ResolvedAddress } from './resolver';
import { RATE_LIMITS, SHARED_CLIENT_KEY, clientKey, createTokenBucket, type TokenBucket } from './rate-limit';

/**
 * The rate-limit buckets of the web actions (ADR 0004 section 6). Buckets are created lazily and
 * live per process, so limits are per instance and best effort on serverless hosts.
 */

export type BucketName = keyof typeof RATE_LIMITS;

const buckets = new Map<BucketName, TokenBucket>();

function bucket(name: BucketName): TokenBucket {
  let existing = buckets.get(name);
  if (!existing) {
    existing = createTokenBucket(RATE_LIMITS[name]);
    buckets.set(name, existing);
  }
  return existing;
}

/** Forgets every bucket. Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Client identity from the request headers, or null when none can be trusted. */
async function currentClientKey(): Promise<string | null> {
  return clientKey(await headers(), { onVercel: process.env.VERCEL === '1', trustProxy: getTrustProxyHeaders() });
}

/**
 * Takes a token from `name` for the calling client. With no trustworthy client identity the
 * per-client RPC bucket is skipped (it would merge every user), the others use a shared key.
 */
export async function takeClientToken(name: BucketName, options: { skipWithoutIdentity?: boolean } = {}): Promise<boolean> {
  const key = await currentClientKey();
  if (key === null && options.skipWithoutIdentity) return true;
  return bucket(name).take(key ?? SHARED_CLIENT_KEY);
}

/**
 * Caller identity for the per-client lookup slot, or undefined when none can be trusted: a slot
 * keyed on a merged identity would let one hung name lock every user out (the global lookup cap
 * and the negative cache still apply).
 */
export async function currentLookupKey(): Promise<string | undefined> {
  return (await currentClientKey()) ?? undefined;
}

/**
 * Takes one token per resolved address from the destination bucket and refuses the call when any
 * address is out of tokens. Keyed by address (IPv6 per /64), not by host name, so wildcard DNS,
 * trailing dots, numeric spellings and extra addresses next to a victim's all count against the
 * address they reach. Pass it as `onResolved`; it throws `OutboundError('RATE_LIMITED')`.
 */
export function takeDestinationTokens(addresses: readonly ResolvedAddress[]): void {
  const destination = bucket('rpcDestination');
  // Every key is charged even after one is refused: probing a victim address through a fresh
  // address must not refill anything for the others.
  const allowed = destinationKeys(addresses).map((key) => destination.take(key));
  if (allowed.includes(false)) throw new OutboundError('RATE_LIMITED');
}
