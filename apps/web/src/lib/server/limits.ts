import { headers } from 'next/headers';
import { getTrustProxyHeaders } from './env';
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

/** Takes a token from the destination bucket for a validated host. */
export function takeDestinationToken(host: string): boolean {
  return bucket('rpcDestination').take(host.toLowerCase());
}
