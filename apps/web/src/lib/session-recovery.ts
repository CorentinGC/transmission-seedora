import type { IpcResponse, ServerConfig } from '@shared/types';
import { setActiveServerCookie } from './server-actions/session';
import { getActiveServerId, getServers } from './web-storage';

/** Largest IP batch the server accepts (`MAX_GEOIP_IPS` in `server/schemas.ts`, which the client cannot import). */
export const GEOIP_CHUNK_SIZE = 512;

/** Splits `items` into batches of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** Default Transmission RPC path (`DEFAULT_RPC_PATH` in `server/schemas.ts`). */
const DEFAULT_PATH = '/transmission/rpc';

/**
 * The fields the server accepts, with the path normalised the way the old proxy and Electron did
 * (empty means the default, a missing leading slash is added). Proxy fields never go to the server.
 */
export function toServerTarget(config: Pick<ServerConfig, 'host' | 'port' | 'path' | 'useSSL' | 'username' | 'password'>) {
  const path = config.path?.trim() ? config.path.trim() : DEFAULT_PATH;
  return {
    host: config.host,
    port: config.port,
    path: path.startsWith('/') ? path : `/${path}`,
    useSSL: config.useSSL,
    username: config.username || undefined,
    password: config.password || undefined,
  };
}

type CodedResponse = IpcResponse & { code?: string };

// Concurrent calls (the poll fires several at once) share one re-seal.
let reseal: Promise<boolean> | null = null;

/** Re-seals the session cookie from the active server kept in `localStorage`. False when that is impossible. */
async function resealFromStorage(): Promise<boolean> {
  const id = getActiveServerId();
  const server = id ? getServers().find((s) => s.id === id) : undefined;
  if (!server) return false;
  const result = await setActiveServerCookie(toServerTarget(server));
  return result.success;
}

/**
 * Runs a server-action call. On `NO_SESSION` (first load after a deploy, secret rotation, expiry,
 * cleared cookie) it re-seals the cookie from `localStorage` and retries the call once (ADR 0002 section 6).
 */
export async function withSessionRecovery<T extends CodedResponse>(call: () => Promise<T>): Promise<T> {
  const first = await call();
  if (first.success || first.code !== 'NO_SESSION') return first;
  reseal ??= resealFromStorage().finally(() => {
    reseal = null;
  });
  if (!(await reseal)) return first;
  return call();
}
