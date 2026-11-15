'use server';

import { failureFromError } from '../server/action-error';
import { readActiveServer } from '../server/active-session';
import { failure } from '../server/errors';
import { takeClientToken, takeDestinationToken } from '../server/limits';
import { rpcCallSchema, serverTargetSchema } from '../server/schemas';
import {
  TEST_TIMEOUT_MS,
  callTransmission,
  timeoutForMethod,
  type ActionResult,
} from '../server/transmission';

/**
 * Forwards one allowlisted RPC call to the daemon of the sealed session (ADR 0004). Order:
 * client rate limit, validation, session, destination rate limit, call. Failures carry a fixed code.
 */
export async function rpcRequest(method: string, args?: unknown): Promise<ActionResult> {
  try {
    if (!(await takeClientToken('rpcClient', { skipWithoutIdentity: true }))) return failure('RATE_LIMITED');
    const call = rpcCallSchema.safeParse({ method, args });
    if (!call.success) return failure('INVALID_INPUT');
    const target = await readActiveServer();
    if (!target) return failure('NO_SESSION');
    if (!takeDestinationToken(target.host)) return failure('RATE_LIMITED');
    return await callTransmission(target, call.data, timeoutForMethod(call.data.method));
  } catch (error) {
    return failureFromError(error);
  }
}

/** Tests a server without saving it: `session-get` for the version, within 8 s. */
export async function testServerConnection(input: unknown): Promise<ActionResult<never>> {
  try {
    if (!(await takeClientToken('testConnection'))) return failure('RATE_LIMITED');
    const target = serverTargetSchema.safeParse(input);
    if (!target.success) return failure('INVALID_INPUT');
    if (!takeDestinationToken(target.data.host)) return failure('RATE_LIMITED');
    const result = await callTransmission(
      target.data,
      { method: 'session-get', args: { fields: ['version'] } },
      TEST_TIMEOUT_MS,
    );
    return result.success ? { success: true } : result;
  } catch (error) {
    return failureFromError(error);
  }
}
