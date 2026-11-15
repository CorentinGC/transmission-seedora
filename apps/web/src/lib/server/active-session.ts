import { cookies } from 'next/headers';
import {
  LEGACY_COOKIE_NAME,
  getSessionCookieName,
  getSessionCookieOptions,
  sealSession,
  unsealSession,
} from './session-cookie';
import type { ServerTarget } from './schemas';

/**
 * Reads and writes the sealed active-server cookie (ADR 0002). The decrypted target never leaves
 * the server: it is only returned to other `lib/server` modules, never from a `'use server'` file.
 */

/** The active server, or null when the cookie is missing, forged, expired or from another version. */
export async function readActiveServer(): Promise<ServerTarget | null> {
  const jar = await cookies();
  const payload = await unsealSession(jar.get(getSessionCookieName())?.value);
  if (!payload) return null;
  return {
    host: payload.host,
    port: payload.port,
    path: payload.path,
    useSSL: payload.useSSL,
    username: payload.username,
    password: payload.password,
  };
}

/** Seals `target` into the session cookie and deletes the legacy cookie. */
export async function writeActiveServer(target: ServerTarget): Promise<void> {
  const sealed = await sealSession(target);
  const jar = await cookies();
  jar.set(getSessionCookieName(), sealed, getSessionCookieOptions());
  jar.delete(LEGACY_COOKIE_NAME);
}

/** Expires the session cookie and deletes the legacy cookie. */
export async function clearActiveServer(): Promise<void> {
  const jar = await cookies();
  // `set` with maxAge 0 keeps the `Secure` and `Path` attributes the `__Host-` prefix requires.
  jar.set(getSessionCookieName(), '', { ...getSessionCookieOptions(), maxAge: 0 });
  jar.delete(LEGACY_COOKIE_NAME);
}
