/**
 * Client-safe helpers for the server-target payload sent to the web actions. This file imports no
 * server code, so `web-api.ts` and `server/schemas.ts` can both use it without duplicating constants.
 */

/** Default Transmission RPC path; `server/schemas.ts` re-exports it as the schema default. */
export const DEFAULT_RPC_PATH = '/transmission/rpc';

/** Largest IP batch the server accepts (`MAX_GEOIP_IPS` in `server/schemas.ts`, which a test keeps equal). */
export const GEOIP_CHUNK_SIZE = 512;

/** The connection fields the server accepts for one daemon. */
export interface ServerTargetPayload {
  host: string;
  port: number;
  path: string;
  useSSL: boolean;
  username: string | undefined;
  password: string | undefined;
  /** Only ever `true` or absent: the opt-in to accept an untrusted TLS certificate. */
  allowSelfSigned: true | undefined;
}

/** Splits `items` into batches of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/**
 * The fields the server accepts, normalised the way the old proxy and Electron did: the host is
 * trimmed, an empty path means the default and a missing leading slash is added. Proxy fields
 * and empty credentials never go to the server.
 */
export function toServerTarget(config: {
  host: string;
  port: number;
  path?: string;
  useSSL: boolean;
  username?: string;
  password?: string;
  allowSelfSigned?: boolean;
}): ServerTargetPayload {
  const path = config.path?.trim() ? config.path.trim() : DEFAULT_RPC_PATH;
  return {
    host: config.host.trim(),
    port: config.port,
    path: path.startsWith('/') ? path : `/${path}`,
    useSSL: config.useSSL,
    username: config.username || undefined,
    password: config.password || undefined,
    allowSelfSigned: config.useSSL && config.allowSelfSigned === true ? true : undefined,
  };
}
