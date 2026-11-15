import { ConfigError } from './env';
import { OutboundError, failure, type ErrorCode } from './errors';
import { SessionTooLargeError } from './session-cookie';

const SYSTEM_CODE = /^[A-Z0-9_]{1,40}$/;

/**
 * Logs that an action failed unexpectedly: the error class name, the code returned to the caller
 * and, when the error has one, its system code (`ENOENT`, `ERR_...`). Nothing else: a message can
 * carry a host, an address or a credential, so it is never read.
 */
export function logActionFailure(error: unknown, code: ErrorCode): void {
  const name = error instanceof Error ? error.name : 'NonError';
  const raw = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  const errno = typeof raw === 'string' && SYSTEM_CODE.test(raw) ? raw : undefined;
  console.error('Server action failed', errno ? { name, code, errno } : { name, code });
}

/**
 * Maps anything thrown inside an action to a fixed error result. Only the class of the error is
 * inspected, never its message, so no credential or resolved address can leak. Expected failures
 * (`OutboundError`, an oversized session) are not logged; configuration and unknown errors are,
 * by class name and code only.
 */
export function failureFromError(error: unknown): { success: false; error: string; code: ErrorCode } {
  if (error instanceof OutboundError) return failure(error.code);
  // Only the caller's input can make a session too large for a cookie.
  if (error instanceof SessionTooLargeError) return failure('INVALID_INPUT');
  const code: ErrorCode = error instanceof ConfigError ? 'SERVER_MISCONFIGURED' : 'CONNECTION_FAILED';
  logActionFailure(error, code);
  return failure(code);
}
