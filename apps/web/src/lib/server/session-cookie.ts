import { createHash } from 'node:crypto';
import { sealData, unsealData } from 'iron-session';
import { getCookieSecrets, isProduction, type EnvSource } from './env';
import { serverTargetSchema, sessionPayloadSchema, type SessionPayload } from './schemas';

/**
 * Sealed active-server cookie (ADR 0002): seal and unseal helpers only. Reading and writing the
 * cookie jar happens in the actions. Nothing here logs, and no error carries a secret or payload.
 */

/** Seal lifetime, enforced cryptographically regardless of `Max-Age`. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Cookie `Max-Age`: the seal lifetime minus a minute, so the cookie never outlives its seal. */
export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_SECONDS - 60;

/** Name of the pre-ADR-0002 base64 cookie. It is never parsed, only deleted. */
export const LEGACY_COOKIE_NAME = 'seedora_server';

/** Browsers reject cookies above this many bytes. */
const MAX_COOKIE_BYTES = 4096;

/** Name of the session cookie: the `__Host-` prefix needs `Secure`, so it is production-only. */
export function getSessionCookieName(env: EnvSource = process.env): string {
  return isProduction(env) ? '__Host-seedora-session' : 'seedora-session';
}

/** Attributes for `cookies().set` (ADR 0002 section 4). No `Domain`, as `__Host-` requires. */
export function getSessionCookieOptions(env: EnvSource = process.env): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'strict';
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: isProduction(env),
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE,
  };
}

/** iron-session id for a secret: a positive 31-bit integer derived from its SHA-256, so ids need no management. */
function secretId(secret: string): number {
  const digest = createHash('sha256').update(`seedora-session-id:${secret}`).digest();
  return (digest.readUInt32BE(0) & 0x7fffffff) || 1;
}

/**
 * Seals a server target as the cookie value, always with the current secret.
 * @throws ConfigError when the secret is missing (production) or too short.
 * @throws Error with a fixed message when `target` is not a valid server target.
 */
export async function sealSession(target: unknown, env: EnvSource = process.env): Promise<string> {
  const parsed = serverTargetSchema.safeParse(target);
  if (!parsed.success) throw new Error('Invalid session target');
  const { current } = getCookieSecrets(env);
  const payload: SessionPayload = { v: 1, ...parsed.data };
  const sealed = await sealData(payload, { password: { [secretId(current)]: current }, ttl: SESSION_TTL_SECONDS });
  if (Buffer.byteLength(sealed, 'utf8') > MAX_COOKIE_BYTES) throw new Error('Session is too large');
  return sealed;
}

/**
 * Opens a cookie value with the current secret, then the previous one (rotation).
 * Returns null for anything that is not a valid, unexpired, correctly shaped session: a missing,
 * oversized, forged, tampered, expired or wrongly versioned cookie all read as "no session".
 * @throws ConfigError when the secret is missing (production) or too short.
 */
export async function unsealSession(
  value: string | undefined,
  env: EnvSource = process.env,
): Promise<SessionPayload | null> {
  const { current, previous } = getCookieSecrets(env);
  if (!value || Buffer.byteLength(value, 'utf8') > MAX_COOKIE_BYTES) return null;
  const password: Record<number, string> = { [secretId(current)]: current };
  if (previous && secretId(previous) !== secretId(current)) password[secretId(previous)] = previous;
  try {
    const data = await unsealData<unknown>(value, { password, ttl: SESSION_TTL_SECONDS });
    const parsed = sessionPayloadSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
