import { z } from 'zod';

/**
 * Validation of a parsed backup file for the web `configImport`. Mirrors `importedServerSchema` and
 * `importedPrefsSchema` in `src/main/security/schemas.ts` (Electron contract); kept separate because
 * the web bundle must not import from `src/`. Unknown keys are dropped, not rejected.
 */

const shortString = (max: number) => z.string().max(max);

/** Hostname, IPv4 address or bracketed IPv6 literal: nothing that could change the URL built from it. */
const HOST_PATTERN = /^(?:[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])$/;
/** RPC endpoint path: absolute, no query, fragment, backslash or whitespace. */
const RPC_PATH_PATTERN = /^\/[A-Za-z0-9._~/-]*$/;

/** Server entry of a backup; `id` and `allowSelfSigned` are not part of the output. */
export const importedServerSchema = z.object({
  name: shortString(200),
  host: z.string().min(1).max(255).regex(HOST_PATTERN),
  port: z.number().int().min(1).max(65535),
  path: shortString(500).regex(RPC_PATH_PATTERN),
  useSSL: z.boolean(),
  username: shortString(500).optional(),
  password: shortString(2000).optional(),
  proxyType: z.enum(['none', 'http', 'socks5']).optional(),
  proxyHost: shortString(255).optional(),
  proxyPort: z.number().int().min(1).max(65535).optional(),
  proxyUsername: shortString(500).optional(),
  proxyPassword: shortString(2000).optional(),
});

/** Preferences of a backup: every key optional (partial patch). */
export const importedPrefsSchema = z
  .object({
    pollingInterval: z.number().int().min(250).max(3_600_000),
    theme: z.enum(['light', 'dark', 'system']),
    minimizeToTray: z.boolean(),
    closeToTray: z.boolean(),
    showNotifications: z.boolean(),
    confirmOnAdd: z.boolean(),
    relativeDates: z.boolean(),
    language: z.string().min(2).max(16),
    watchFolder: shortString(4096).optional(),
    watchFolderEnabled: z.boolean(),
    deleteWatchedTorrent: z.boolean(),
    pathMappings: z.array(z.strictObject({ remote: shortString(4096), local: shortString(4096) })).max(200),
    columnVisibility: z.record(shortString(100), z.boolean()).optional(),
    columnSizing: z.record(shortString(100), z.number().finite().min(0).max(10_000)).optional(),
    columnOrder: z.array(shortString(100)).max(200).optional(),
    speedPresets: z.array(z.number().finite().min(0).max(10_000_000)).max(50).optional(),
  })
  .partial();

/** Parsed content of a backup file. */
export const importDataSchema = z.object({
  servers: z.array(importedServerSchema).max(1000).optional(),
  preferences: importedPrefsSchema.optional(),
});
