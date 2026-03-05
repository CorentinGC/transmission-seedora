import { ipcMain } from 'electron';
import { registerConfigHandlers } from './config-handlers';
import { registerRpcHandlers } from './rpc-handlers';
import { IPC } from '@shared/ipc-channels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let geoip: any = null;

export function registerIpcHandlers(): void {
  registerConfigHandlers();
  registerRpcHandlers();

  // GeoIP lookup (lazy-loaded to avoid crash if module unavailable in packaged build)
  ipcMain.handle(IPC.GEOIP_LOOKUP, async (_event, ips: string[]) => {
    if (!geoip) {
      try {
        geoip = await import('geoip-lite');
      } catch {
        console.warn('[GeoIP] geoip-lite module not available');
        return { success: true, data: Object.fromEntries(ips.map((ip) => [ip, null])) };
      }
    }
    const lookup = geoip.default?.lookup ?? geoip.lookup;
    const results: Record<string, { country: string; region: string; city: string } | null> = {};
    for (const ip of ips) {
      const geo = lookup(ip);
      results[ip] = geo ? { country: geo.country, region: geo.region, city: geo.city } : null;
    }
    return { success: true, data: results };
  });
}
