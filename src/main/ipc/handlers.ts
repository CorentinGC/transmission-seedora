import { isIP } from 'node:net';
import { z } from 'zod';
import { IPC } from '@ipc/ipc-channels';
import { registerConfigHandlers } from './config-handlers';
import { registerDialogHandlers } from './dialog-handlers';
import { registerRpcHandlers } from './rpc-handlers';
import { handleGuarded, type SenderValidator } from '../security/ipc-guard';
import { geoipIpsSchema } from '../security/schemas';

interface GeoLookup {
  lookup: (ip: string) => { country: string; region: string; city: string } | null;
}

let geoip: GeoLookup | null = null;

async function loadGeoip(): Promise<GeoLookup | null> {
  if (geoip) return geoip;
  try {
    const mod = (await import('geoip-lite')) as unknown as { default?: GeoLookup } & Partial<GeoLookup>;
    const lookup = mod.default?.lookup ?? mod.lookup;
    if (!lookup) return null;
    geoip = { lookup };
    return geoip;
  } catch {
    console.warn('[GeoIP] geoip-lite module not available');
    return null;
  }
}

/** Registers every IPC channel; each handler checks the sender frame and validates its arguments. */
export function registerIpcHandlers(isTrusted: SenderValidator): void {
  registerConfigHandlers(isTrusted);
  registerDialogHandlers(isTrusted);
  registerRpcHandlers(isTrusted);

  // GeoIP lookup (lazy-loaded to avoid crash if module unavailable in packaged build)
  handleGuarded(isTrusted, IPC.GEOIP_LOOKUP, z.tuple([geoipIpsSchema]), async (_e, [ips]) => {
    const db = await loadGeoip();
    const entries = ips.map((ip): [string, { country: string; region: string; city: string } | null] => {
      const geo = db && isIP(ip) ? db.lookup(ip) : null;
      return [ip, geo ? { country: geo.country, region: geo.region, city: geo.city } : null];
    });
    return { success: true, data: Object.fromEntries(entries) };
  });
}
