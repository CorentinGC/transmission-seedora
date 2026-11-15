import { randomBytes } from 'node:crypto';

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

/**
 * Boot-time configuration check, called from `instrumentation.ts`. Throws `ConfigError`
 * on a misconfigured deployment and logs one warning when private hosts are allowed.
 */
export function assertServerConfig(env: EnvSource = process.env): void {
  getCookieSecrets(env);
  if (getAllowPrivateHosts(env)) {
    console.warn('SEEDORA_ALLOW_PRIVATE_HOSTS=true: private network addresses are reachable. Do not use on a public deployment.');
  }
}
