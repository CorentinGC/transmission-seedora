import { randomBytes } from 'node:crypto';
import { hostSchema } from './schemas';

/**
 * Lazy, validated reads of the server environment (ADR 0002 section 3, ADR 0003, ADR 0004).
 * Nothing here runs at module load, so `next build` works without secrets. No value is ever
 * logged or put in an error message.
 */

/** Environment shape accepted by the readers; `process.env` satisfies it. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Minimum length of a cookie secret (iron-session requires 32 characters). */
export const MIN_SECRET_LENGTH = 32;

/** `globalThis` slot holding the per-process development secret, so it survives HMR. */
export const DEV_SECRET_SLOT = Symbol.for('seedora.dev-cookie-secret');

/** Configuration problem. Actions map it to `SERVER_MISCONFIGURED`; the message is fixed text. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Secret used to seal new cookies, plus an optional secret accepted for reading only. */
export interface CookieSecrets {
  current: string;
  previous?: string;
}

type DevSecretHolder = { [DEV_SECRET_SLOT]?: string };

/** True when running a production server or build (`NODE_ENV=production`). */
export function isProduction(env: EnvSource = process.env): boolean {
  return env.NODE_ENV === 'production';
}

function readSecret(env: EnvSource, name: 'COOKIE_SECRET' | 'COOKIE_SECRET_PREVIOUS'): string | undefined {
  const value = env[name];
  if (value === undefined || value === '') return undefined;
  if (value.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return value;
}

function developmentSecret(): string {
  const holder = globalThis as DevSecretHolder;
  const existing = holder[DEV_SECRET_SLOT];
  if (existing) return existing;
  const generated = randomBytes(32).toString('base64');
  holder[DEV_SECRET_SLOT] = generated;
  console.warn('COOKIE_SECRET is not set: using a random per-process secret. Sessions will not survive a restart.');
  return generated;
}

/**
 * Reads `COOKIE_SECRET` and `COOKIE_SECRET_PREVIOUS`.
 * Production: a missing or short `COOKIE_SECRET` throws. Development and test: a random
 * per-process secret is used when it is unset. A set but short secret always throws.
 */
export function getCookieSecrets(env: EnvSource = process.env): CookieSecrets {
  const configured = readSecret(env, 'COOKIE_SECRET');
  if (!configured && isProduction(env)) {
    throw new ConfigError(`COOKIE_SECRET is required in production (at least ${MIN_SECRET_LENGTH} characters)`);
  }
  const current = configured ?? developmentSecret();
  const previous = readSecret(env, 'COOKIE_SECRET_PREVIOUS');
  return previous && previous !== current ? { current, previous } : { current };
}

/** `SEEDORA_ALLOW_PRIVATE_HOSTS`: only the exact string `true` enables it (ADR 0003). */
export function getAllowPrivateHosts(env: EnvSource = process.env): boolean {
  return env.SEEDORA_ALLOW_PRIVATE_HOSTS === 'true';
}

/** `SEEDORA_TRUST_PROXY_HEADERS`: only the exact string `true` enables it (ADR 0004 section 6). */
export function getTrustProxyHeaders(env: EnvSource = process.env): boolean {
  return env.SEEDORA_TRUST_PROXY_HEADERS === 'true';
}

/** One `SEEDORA_ALLOWED_HOSTS` entry: a lowercase host without brackets, and an optional port. */
export interface AllowedHost {
  host: string;
  port?: number;
}

const ALLOWED_HOST_PORT = /^\d{1,5}$/;

function parseAllowedHost(entry: string): AllowedHost {
  const invalid = () =>
    new ConfigError('SEEDORA_ALLOWED_HOSTS has an invalid entry: use host or host:port, IPv6 as [addr] or [addr]:port');
  let host = entry;
  let portText: string | undefined;
  if (entry.startsWith('[')) {
    const end = entry.indexOf(']');
    if (end < 0) throw invalid();
    const rest = entry.slice(end + 1);
    if (rest !== '' && !rest.startsWith(':')) throw invalid();
    host = entry.slice(0, end + 1);
    portText = rest === '' ? undefined : rest.slice(1);
  } else if (entry.split(':').length === 2) {
    [host, portText] = entry.split(':');
  }
  if (!hostSchema.safeParse(host).success) throw invalid();
  if (portText === undefined) return { host: host.replace(/^\[|\]$/g, '').toLowerCase() };
  const port = Number(portText);
  if (!ALLOWED_HOST_PORT.test(portText) || port < 1 || port > 65535) throw invalid();
  return { host: host.replace(/^\[|\]$/g, '').toLowerCase(), port };
}

/**
 * `SEEDORA_ALLOWED_HOSTS`: comma-separated `host` or `host:port` entries (IPv6 as `[addr]` or
 * `[addr]:port`), compared exactly with the host the user entered. Null when unset or blank.
 * With `SEEDORA_ALLOW_PRIVATE_HOSTS=true`, only listed hosts may resolve to private addresses.
 * @throws ConfigError when an entry is malformed (the message never echoes the value).
 */
export function getAllowedHosts(env: EnvSource = process.env): AllowedHost[] | null {
  const raw = env.SEEDORA_ALLOWED_HOSTS;
  if (raw === undefined || raw.trim() === '') return null;
  return raw.split(',').map((entry) => parseAllowedHost(entry.trim()));
}

/** True when `host` (bracket-free, any case) and `port` match an allowlist entry; an entry without a port matches any. */
export function isListedHost(list: readonly AllowedHost[], host: string, port: number): boolean {
  const name = host.toLowerCase();
  return list.some((entry) => entry.host === name && (entry.port === undefined || entry.port === port));
}

/**
 * Boot-time configuration check, called from `instrumentation.ts`. Throws `ConfigError`
 * on a misconfigured deployment and logs one warning when private hosts are allowed.
 */
export function assertServerConfig(env: EnvSource = process.env): void {
  getCookieSecrets(env);
  const allowedHosts = getAllowedHosts(env);
  if (getAllowPrivateHosts(env)) {
    console.warn(
      allowedHosts
        ? 'SEEDORA_ALLOW_PRIVATE_HOSTS=true: private network addresses are reachable for the hosts in SEEDORA_ALLOWED_HOSTS only.'
        : 'SEEDORA_ALLOW_PRIVATE_HOSTS=true: private network addresses are reachable. Do not use on a public deployment. Set SEEDORA_ALLOWED_HOSTS to limit them.',
    );
  } else if (allowedHosts) {
    console.warn('SEEDORA_ALLOWED_HOSTS is set but has no effect without SEEDORA_ALLOW_PRIVATE_HOSTS=true.');
  }
}
