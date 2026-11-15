'use server';

import { logActionFailure } from '../server/action-error';
import { failure } from '../server/errors';
import { takeClientToken } from '../server/limits';
import { geoipInputSchema } from '../server/schemas';
import type { ActionResult } from '../server/transmission';

/** Country, region and city of one IP address. */
type GeoRecord = { country: string; region: string; city: string };

/** Looks up at most 512 IP addresses in the bundled GeoIP database. */
export async function geoipLookup(input: unknown): Promise<ActionResult<Record<string, GeoRecord | null>>> {
  try {
    if (!(await takeClientToken('geoip', { skipWithoutIdentity: true }))) return failure('RATE_LIMITED');
    const ips = geoipInputSchema.safeParse(input);
    if (!ips.success) return failure('INVALID_INPUT');
    const geoip = await import('geoip-lite');
    const data: Record<string, GeoRecord | null> = {};
    for (const ip of ips.data) {
      const geo = geoip.lookup(ip);
      data[ip] = geo ? { country: geo.country, region: geo.region, city: geo.city } : null;
    }
    return { success: true, data };
  } catch (error) {
    // The database failed to load: a server problem, nothing the caller sent.
    logActionFailure(error, 'SERVER_MISCONFIGURED');
    return failure('SERVER_MISCONFIGURED');
  }
}
