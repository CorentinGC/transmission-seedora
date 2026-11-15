'use server';

import { failureFromError } from '../server/action-error';
import { clearActiveServer, writeActiveServer } from '../server/active-session';
import { failure } from '../server/errors';
import { takeClientToken } from '../server/limits';
import { serverTargetSchema } from '../server/schemas';
import type { ActionResult } from '../server/transmission';

/**
 * Stores the active server in the sealed session cookie (ADR 0002). Public endpoint: the input
 * is validated, and the host guard still runs on every outbound request.
 */
export async function setActiveServerCookie(input: unknown): Promise<ActionResult<never>> {
  try {
    if (!(await takeClientToken('setActiveServer'))) return failure('RATE_LIMITED');
    const parsed = serverTargetSchema.safeParse(input);
    if (!parsed.success) return failure('INVALID_INPUT');
    await writeActiveServer(parsed.data);
    return { success: true };
  } catch (error) {
    return failureFromError(error);
  }
}

/** Expires the session cookie and the legacy cookie. */
export async function clearServerCookie(): Promise<ActionResult<never>> {
  try {
    await clearActiveServer();
    return { success: true };
  } catch (error) {
    return failureFromError(error);
  }
}
