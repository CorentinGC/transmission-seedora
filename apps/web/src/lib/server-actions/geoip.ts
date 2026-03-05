'use server';

export async function geoipLookup(
  ips: string[],
): Promise<{ success: boolean; data?: Record<string, { country: string; region: string; city: string } | null> }> {
  try {
    const geoip = await import('geoip-lite');
    const results: Record<string, { country: string; region: string; city: string } | null> = {};

    for (const ip of ips) {
      const geo = geoip.lookup(ip);
      results[ip] = geo
        ? { country: geo.country, region: geo.region, city: geo.city }
        : null;
    }

    return { success: true, data: results };
  } catch {
    return { success: false };
  }
}
