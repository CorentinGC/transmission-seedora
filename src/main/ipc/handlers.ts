import { ipcMain } from 'electron';
import { registerConfigHandlers } from './config-handlers';
import { registerRpcHandlers } from './rpc-handlers';
import { IPC } from '@shared/ipc-channels';
import geoip from 'geoip-lite';

export function registerIpcHandlers(): void {
  registerConfigHandlers();
  registerRpcHandlers();

  // GeoIP lookup
  ipcMain.handle(IPC.GEOIP_LOOKUP, (_event, ips: string[]) => {
    const results: Record<string, { country: string; region: string; city: string } | null> = {};
    for (const ip of ips) {
      const geo = geoip.lookup(ip);
      results[ip] = geo ? { country: geo.country, region: geo.region, city: geo.city } : null;
    }
    return { success: true, data: results };
  });
}
