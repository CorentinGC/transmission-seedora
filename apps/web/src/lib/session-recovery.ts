import type { IpcResponse } from '@shared/types';
import { ERROR_MESSAGES } from './server/errors';
import { setActiveServerCookie } from './server-actions/session';
import { toServerTarget } from './server-target';
import { getActiveServerId, getServers } from './web-storage';

type CodedResponse = IpcResponse & { code?: string };

/** How long re-sealing stays off after it did not bring the session back (cookies blocked, clock skew). */
export const RESEAL_COOLDOWN_MS = 30_000;

const sessionUnavailable: CodedResponse = {
  success: false,
  error: ERROR_MESSAGES.SESSION_UNAVAILABLE,
  code: 'SESSION_UNAVAILABLE',
};

// Concurrent calls (the poll fires several at once) share one re-seal.
let reseal: Promise<CodedResponse | null> | null = null;
let resealBlockedUntil = 0;

/** Forgets the shared re-seal and the cool-down. Test helper. */
export function resetSessionRecovery(): void {
  reseal = null;
  resealBlockedUntil = 0;
}

/**
 * Re-seals the session cookie from the active server kept in `localStorage`. Returns null when
 * there is none, else the action result. If the active server changed while the cookie was being
 * written (a switch raced with this re-seal), the new one is sealed too so the cookie never ends
 * up on the old server.
 */
async function resealFromStorage(): Promise<CodedResponse | null> {
  let result: CodedResponse | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = getActiveServerId();
    const server = id ? getServers().find((s) => s.id === id) : undefined;
    if (!server) return result;
    result = await setActiveServerCookie(toServerTarget(server));
    if (!result.success || getActiveServerId() === id) return result;
  }
  return result;
}

/**
 * Runs a server-action call. On `NO_SESSION` (first load after a deploy, secret rotation, expiry,
 * cleared cookie) it re-seals the cookie from `localStorage` and retries the call once (ADR 0002 section 6).
 * A re-seal that fails returns its own failure (a `RATE_LIMITED` one also starts the cool-down).
 * A re-seal that succeeds but does not bring the
 * session back stops further re-sealing for `RESEAL_COOLDOWN_MS` and returns `SESSION_UNAVAILABLE`.
 */
export async function withSessionRecovery<T extends CodedResponse>(call: () => Promise<T>): Promise<T> {
  const first = await call();
  if (first.success || first.code !== 'NO_SESSION') return first;
  if (Date.now() < resealBlockedUntil) return sessionUnavailable as T;
  reseal ??= resealFromStorage().finally(() => {
    reseal = null;
  });
  const resealed = await reseal;
  if (!resealed) return first;
  if (!resealed.success) {
    // A rate-limited re-seal would be repeated by every poll tick and keep the limit saturated.
    if (resealed.code === 'RATE_LIMITED') resealBlockedUntil = Date.now() + RESEAL_COOLDOWN_MS;
    return resealed as T;
  }
  const retry = await call();
  if (!retry.success && retry.code === 'NO_SESSION') {
    resealBlockedUntil = Date.now() + RESEAL_COOLDOWN_MS;
    return sessionUnavailable as T;
  }
  return retry;
}
