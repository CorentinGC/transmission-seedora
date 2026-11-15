'use server';

import { failureFromError } from '../server/action-error';
import { readActiveServer } from '../server/active-session';
import { failure } from '../server/errors';
import { currentLookupKey, takeClientToken, takeDestinationTokens } from '../server/limits';
import { rpcCallSchema, serverTargetSchema } from '../server/schemas';
import { TEST_TIMEOUT_MS, callTransmission, timeoutForMethod, type ActionResult } from '../server/transmission';

/**
 * Forwards one allowlisted RPC call to the daemon of the sealed session (ADR 0004). Order:
 * client rate limit, validation, session, call. The destination rate limit runs once the
 * addresses are resolved (`onResolved`), keyed by address. Failures carry a fixed code.
 * `args` is a JSON string, never an object: the decoder keeps shared references, which would
 * make an object expensive to inspect (ADR 0004 section 2). The type is not trusted at runtime.
 */
export async function rpcRequest(method: string, args?: string): Promise<ActionResult> {
  try {
    if (!(await takeClientToken('rpcClient', { skipWithoutIdentity: true }))) return failure('RATE_LIMITED');
    const call = rpcCallSchema.safeParse({ method, args });
    if (!call.success) return failure('INVALID_INPUT');
    const target = await readActiveServer();
    if (!target) return failure('NO_SESSION');
    return await callTransmission(target, call.data, timeoutForMethod(call.data.method), {
      clientKey: await currentLookupKey(),
      onResolved: takeDestinationTokens,
    });
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
    const result = await callTransmission(
      target.data,
      { method: 'session-get', args: { fields: ['version'] } },
      TEST_TIMEOUT_MS,
      { clientKey: await currentLookupKey(), onResolved: takeDestinationTokens },
    );
    return result.success ? { success: true } : result;
  } catch (error) {
    return failureFromError(error);
  }
}
