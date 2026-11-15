import { z } from 'zod';
import { stripUndefined } from './strip-undefined';

/** Runtime schemas for every value the renderer can send over IPC. */

const shortString = (max: number) => z.string().max(max);
const MAX_IDS = 100_000;
const MAX_JSON_BYTES = 1_000_000;
const MAX_METAINFO_CHARS = 14_000_000;

/** Torrent ids as the UI sends them. */
export const torrentIdsSchema = z.array(z.number().int().nonnegative()).max(MAX_IDS);

/** Server identifier. */
export const serverIdSchema = z.string().min(1).max(100);

/** Hostname, IPv4 address or bracketed IPv6 literal: nothing that could change the URL built from it. */
const HOST_PATTERN = /^(?:[A-Za-z0-9._-]+|\[[0-9A-Fa-f:.]+\])$/;
/** RPC endpoint path: absolute, no query, fragment, backslash or whitespace. */
const RPC_PATH_PATTERN = /^\/[A-Za-z0-9._~/-]*$/;

const serverFields = {
  name: shortString(200),
  host: z.string().min(1).max(255).regex(HOST_PATTERN),
  port: z.number().int().min(1).max(65535),
  path: shortString(500).regex(RPC_PATH_PATTERN),
  useSSL: z.boolean(),
  allowSelfSigned: z.boolean().optional(),
  username: shortString(500).optional(),
  password: shortString(2000).optional(),
  proxyType: z.enum(['none', 'http', 'socks5']).optional(),
  proxyHost: z.union([z.literal(''), z.string().max(255).regex(HOST_PATTERN)]).optional(),
  proxyPort: z.number().int().min(1).max(65535).optional(),
  proxyUsername: shortString(500).optional(),
  proxyPassword: shortString(2000).optional(),
};

/** Flags main adds to the servers it lists; a renderer that echoes a listed server back must not be rejected for them. */
const echoedFlags = { hasPassword: z.boolean().optional(), hasProxyPassword: z.boolean().optional() };

/** `NewServerConfig`; unknown keys are rejected. */
export const newServerSchema = z
  .strictObject({ ...serverFields, ...echoedFlags })
  .transform(({ hasPassword: _hp, hasProxyPassword: _hpp, ...server }) => server);

/** Server connection test: new or existing config. */
export const testServerSchema = z.strictObject({ ...serverFields, ...echoedFlags, id: serverIdSchema.optional() });

/** `SERVER_UPDATE` patch: any server field except `id`; unknown keys are rejected. */
export const serverUpdateSchema = z
  .strictObject({ ...serverFields, ...echoedFlags, clearPassword: z.boolean(), clearProxyPassword: z.boolean() })
  .partial()
  .transform(({ hasPassword: _hp, hasProxyPassword: _hpp, ...patch }) => stripUndefined(patch));

/**
 * Server entry inside an import file: lenient about extra keys (older exports), `id` is regenerated.
 * `allowSelfSigned` is omitted (and therefore stripped): a backup must never silently disable TLS verification.
 */
export const importedServerSchema = z
  .object({ ...serverFields, id: z.string().optional() })
  .omit({ allowSelfSigned: true });

/** Field schemas of the preferences (also used to sanitise stored preferences one field at a time). */
export const preferenceFields = {
  pollingInterval: z.number().int().min(250).max(3_600_000),
  theme: z.enum(['light', 'dark', 'system']),
  minimizeToTray: z.boolean(),
  closeToTray: z.boolean(),
  showNotifications: z.boolean(),
  relativeDates: z.boolean(),
  language: z.string().min(2).max(16),
  watchFolder: shortString(4096).optional(),
  watchFolderEnabled: z.boolean(),
  deleteWatchedTorrent: z.boolean(),
  columnVisibility: z.record(shortString(100), z.boolean()).optional(),
  columnSizing: z.record(shortString(100), z.number().finite().min(0).max(10_000)).optional(),
  columnOrder: z.array(shortString(100)).max(200).optional(),
  speedPresets: z.array(z.number().finite().min(0).max(10_000_000)).max(50).optional(),
};

/** `PREFS_SET` patch; unknown keys are rejected. */
export const prefsPatchSchema = z.strictObject(preferenceFields).partial().transform(stripUndefined);

/** Preferences inside an import file: unknown keys are dropped instead of failing the import. */
export const importedPrefsSchema = z.object(preferenceFields).partial();

/** `CONFIG_EXPORT` options. */
export const exportOptionsSchema = z.strictObject({
  servers: z.boolean().optional(),
  /** Needs the user's approval in a native dialog; without it passwords never leave main. */
  includePasswords: z.boolean().optional(),
  preferences: z.boolean().optional(),
  serverIds: z.array(serverIdSchema).max(1000).optional(),
});

/** Parsed content of a backup file. */
export const importDataSchema = z.object({
  servers: z.array(importedServerSchema).max(1000).optional(),
  preferences: importedPrefsSchema.optional(),
});

/** `CONFIG_IMPORT` argument: either `{ filePath }` (dialog-approved) or the parsed data. */
export const importRequestSchema = z.union([
  z.strictObject({ filePath: z.string().min(1).max(4096) }),
  importDataSchema,
]);

/** Open-directory dialog request: `{ purpose? }` only; `watch-folder` selects the watch-folder approval. */
export const openDirectoryRequestSchema = z.strictObject({ purpose: z.enum(['watch-folder']).optional() }).optional();

/** Open-file dialog request. Legacy renderer options are tolerated but only used to pick a preset. */
export const openFileRequestSchema = z
  .looseObject({
    preset: z.enum(['torrent', 'json']).optional(),
    filters: z
      .array(z.looseObject({ extensions: z.array(z.string()).max(20).optional() }))
      .max(10)
      .optional(),
  })
  .optional();

/** Save-file dialog: `{ defaultPath? }` only (filters are fixed in main) and the content. */
export const saveFileArgsSchema = z.tuple([
  z.looseObject({ defaultPath: shortString(1024).optional() }),
  z.string().max(5_000_000),
]);

const rpcKey = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Free-form RPC argument bag: bounded keys and JSON values (the daemon validates semantics). */
export const rpcParamsSchema = z
  .record(rpcKey, z.union([z.json(), z.undefined()]))
  .refine((v) => JSON.stringify(v).length <= MAX_JSON_BYTES, 'Parameters too large');

/** `torrent-set` / `group-set` style params: must not override the ids the handler sets itself. */
export const rpcParamsWithoutIdsSchema = rpcParamsSchema.refine((v) => !('ids' in v), 'ids not allowed here');

/** `torrent-add` params: allowlisted keys only. */
export const torrentAddSchema = z.strictObject({
  filename: z.string().min(1).max(8192).optional(),
  metainfo: z
    .string()
    .max(MAX_METAINFO_CHARS)
    .regex(/^[A-Za-z0-9+/=\s]*$/)
    .optional(),
  'download-dir': shortString(4096).optional(),
  labels: z.array(shortString(256)).max(100).optional(),
  paused: z.boolean().optional(),
  'peer-limit': z.number().int().min(0).max(100_000).optional(),
  bandwidthPriority: z.number().int().min(-1).max(1).optional(),
  'files-wanted': z.array(z.number().int().nonnegative()).max(MAX_IDS).optional(),
  'files-unwanted': z.array(z.number().int().nonnegative()).max(MAX_IDS).optional(),
  'priority-high': z.array(z.number().int().nonnegative()).max(MAX_IDS).optional(),
  'priority-normal': z.array(z.number().int().nonnegative()).max(MAX_IDS).optional(),
  'priority-low': z.array(z.number().int().nonnegative()).max(MAX_IDS).optional(),
  sequential_download: z.boolean().optional(),
  cookies: shortString(8192).optional(),
});

/** Tray state pushed by the renderer. */
export const trayStateSchema = z.strictObject({
  downloadSpeed: z.number().finite().min(0),
  uploadSpeed: z.number().finite().min(0),
  activeCount: z.number().int().min(0),
  altSpeedEnabled: z.boolean(),
});

/** Notification request pushed by the renderer; over-long text is truncated, not dropped. */
export const notificationSchema = z.strictObject({
  title: z.string().transform((v) => v.slice(0, 200)),
  body: z.string().transform((v) => v.slice(0, 1000)),
});

const MAX_GEOIP_LOOKUPS = 512;

/** GeoIP lookup input: bounded on input, then de-duplicated and truncated to 512 entries (not rejected). */
export const geoipIpsSchema = z
  .array(shortString(64))
  .max(MAX_IDS)
  .transform((ips) => [...new Set(ips)].slice(0, MAX_GEOIP_LOOKUPS));

/** Dialog presets resolved to fixed main-side options. */
export type OpenPreset = 'torrent' | 'json';

/** Picks a preset from a (possibly legacy) open-file request; anything else the renderer sent is ignored. */
export function resolveOpenPreset(request: z.infer<typeof openFileRequestSchema>): OpenPreset {
  if (request?.preset) return request.preset;
  const wantsJson = request?.filters?.some((f) => f.extensions?.some((e) => e.toLowerCase() === 'json'));
  return wantsJson ? 'json' : 'torrent';
}
