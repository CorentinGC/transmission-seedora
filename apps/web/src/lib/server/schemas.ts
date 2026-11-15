import { isIP } from 'node:net';
import { z } from 'zod';

/**
 * Runtime validation for everything a caller can send to the web server (ADR 0004).
 * Server actions are public endpoints: every argument is parsed here before any DNS lookup or socket.
 * Schemas never echo input values in their messages, so a password cannot leak through an issue list.
 */

/** Largest serialised `arguments` object accepted for an RPC call (matches Next's 1 MB action body limit). */
export const MAX_ARGS_BYTES = 1024 * 1024;

/** Largest GeoIP lookup batch; the client splits larger peer lists into chunks. */
export const MAX_GEOIP_IPS = 512;

/** Default Transmission RPC path. */
export const DEFAULT_RPC_PATH = '/transmission/rpc';

/** The Transmission RPC methods `web-api.ts` uses, and no others (ADR 0004 section 3). */
export const RPC_METHODS = [
  'torrent-get',
  'torrent-set',
  'torrent-add',
  'torrent-remove',
  'torrent-start',
  'torrent-start-now',
  'torrent-stop',
  'torrent-verify',
  'torrent-reannounce',
  'torrent-set-location',
  'torrent-rename-path',
  'queue-move-top',
  'queue-move-up',
  'queue-move-down',
  'queue-move-bottom',
  'session-get',
  'session-set',
  'session-stats',
  'session-close',
  'free-space',
  'port-test',
  'blocklist-update',
  'group-get',
  'group-set',
] as const;

export type RpcMethod = (typeof RPC_METHODS)[number];

const MAX_HOST_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const MAX_PATH_LENGTH = 256;
const MAX_CREDENTIAL_LENGTH = 256;
const MAX_FIELDS = 128;
const MAX_FIELD_LENGTH = 64;
const MAX_ID_STRING_LENGTH = 64;
const MAX_TEXT_LENGTH = 4096;

const LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
/** A final label WHATWG URL parsing would read as a number (`2130706433`, `0x7f`), which resolves to an IPv4 address. */
const NUMERIC_LABEL_PATTERN = /^(?:\d+|0x[0-9a-f]*)$/i;
const PATH_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/;

/** True for a plain LDH hostname: no scheme, port, userinfo, trailing dot or numeric-looking last label. */
function isHostname(value: string): boolean {
  if (value.length > MAX_HOST_LENGTH) return false;
  const labels = value.split('.');
  if (!labels.every((l) => l.length <= MAX_LABEL_LENGTH && LABEL_PATTERN.test(l))) return false;
  return !NUMERIC_LABEL_PATTERN.test(labels[labels.length - 1]);
}

/** True for a hostname, an IPv4 literal, or an IPv6 literal (bare or in brackets). Zone ids are refused. */
function isValidHost(value: string): boolean {
  if (value.length === 0 || value.length > MAX_HOST_LENGTH + 2) return false;
  if (value.startsWith('[')) {
    return value.endsWith(']') && !value.includes('%') && isIP(value.slice(1, -1)) === 6;
  }
  if (value.includes('%')) return false;
  return isIP(value) !== 0 || isHostname(value);
}

const hostSchema = z.string().refine(isValidHost, { message: 'Invalid host' });

const portSchema = z.number().int().min(1).max(65535);

const pathSchema = z
  .string()
  .max(MAX_PATH_LENGTH)
  .regex(PATH_PATTERN, { message: 'Invalid path' })
  .refine((p) => !p.startsWith('//') && !p.split('/').includes('..'), { message: 'Invalid path' });

const credentialSchema = z.string().max(MAX_CREDENTIAL_LENGTH);

/**
 * Where to send RPC calls. Unknown keys (`id`, `name`, proxy fields) are stripped, so the client
 * can pass a full `ServerConfig`.
 */
export const serverTargetSchema = z.object({
  host: hostSchema,
  port: portSchema,
  path: pathSchema.default(DEFAULT_RPC_PATH),
  useSSL: z.boolean(),
  username: credentialSchema.optional(),
  password: credentialSchema.optional(),
});

export type ServerTarget = z.infer<typeof serverTargetSchema>;

/** Payload sealed in the session cookie (ADR 0002 section 5). An unknown `v` reads as "no session". */
export const sessionPayloadSchema = serverTargetSchema.extend({ v: z.literal(1) });

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

const idSchema = z.number().int().min(0).or(z.string().min(1).max(MAX_ID_STRING_LENGTH));
const idsSchema = z.union([idSchema, z.array(idSchema)]);
const fieldsSchema = z.array(z.string().max(MAX_FIELD_LENGTH)).max(MAX_FIELDS);
const textSchema = z.string().max(MAX_TEXT_LENGTH);

/** Shape limits for the arguments every method shares. Other keys are passed through to the daemon. */
const knownArgumentShapes: Record<string, z.ZodType> = {
  ids: idsSchema,
  fields: fieldsSchema,
  location: textSchema,
  path: textSchema,
  name: textSchema,
  filename: textSchema,
  'download-dir': textSchema,
  group: z.union([textSchema, z.array(textSchema)]),
  'delete-local-data': z.boolean(),
  move: z.boolean(),
  paused: z.boolean(),
};

const jsonObjectSchema = z.record(z.string(), z.json());

/** UTF-8 size of the JSON form of `value`; `Infinity` when it cannot be serialised (e.g. too deep). */
function serialisedBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return Infinity;
  }
}

/**
 * Plain JSON object of at most 1 MiB. The daemon validates its own semantics (ADR 0004 section 2),
 * so only the well-known keys get a shape.
 */
const rpcArgsSchema = z.unknown().transform((value, ctx): Record<string, z.core.util.JSONType> => {
  const fail = (): never => {
    ctx.addIssue({ code: 'custom', message: 'Invalid arguments' });
    return z.NEVER;
  };
  if (serialisedBytes(value) > MAX_ARGS_BYTES) return fail();
  if (typeof value === 'object' && value !== null && Object.hasOwn(value, '__proto__')) return fail();
  const parsed = jsonObjectSchema.safeParse(value);
  if (!parsed.success) return fail();
  const args = parsed.data;
  for (const [key, shape] of Object.entries(knownArgumentShapes)) {
    if (Object.hasOwn(args, key) && !shape.safeParse(args[key]).success) return fail();
  }
  return args;
});

/** One RPC call: an allowlisted method and optional arguments. */
export const rpcCallSchema = z.object({
  method: z.enum(RPC_METHODS),
  args: rpcArgsSchema.optional(),
});

export type RpcCall = z.infer<typeof rpcCallSchema>;

/** A GeoIP batch: at most 512 valid IPs (raw length), deduplicated. */
export const geoipInputSchema = z
  .array(z.string().max(45).refine((ip) => !ip.includes('%') && isIP(ip) !== 0, { message: 'Invalid IP' }))
  .max(MAX_GEOIP_IPS)
  .transform((ips) => [...new Set(ips)]);
