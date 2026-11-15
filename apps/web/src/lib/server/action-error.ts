import { ConfigError } from './env';
import { OutboundError, failure, type ErrorCode } from './errors';

/**
 * Maps anything thrown inside an action to a fixed error result. Only the class of the error is
 * inspected, never its message, so no credential or resolved address can leak.
 */
export function failureFromError(error: unknown): { success: false; error: string; code: ErrorCode } {
  if (error instanceof ConfigError) return failure('SERVER_MISCONFIGURED');
  if (error instanceof OutboundError) return failure(error.code);
  return failure('CONNECTION_FAILED');
}
