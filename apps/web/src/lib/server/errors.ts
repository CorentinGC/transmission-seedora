/**
 * Fixed error codes and messages for web server actions (ADR 0004).
 * Nothing derived from `err.message`, resolved addresses or credentials may end up here.
 */

export const ERROR_CODES = [
  'INVALID_INPUT',
  'NO_SESSION',
  'SESSION_UNAVAILABLE',
  'RATE_LIMITED',
  'HOST_NOT_ALLOWED',
  'DNS_FAILED',
  'CONNECTION_FAILED',
  'TIMEOUT',
  'TLS_FAILED',
  'UNEXPECTED_REDIRECT',
  'RESPONSE_TOO_LARGE',
  'AUTH_FAILED',
  'HTTP_ERROR',
  'SESSION_ID_REJECTED',
  'RPC_ERROR',
  'SERVER_MISCONFIGURED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Fixed, caller-safe message for each code. `RPC_ERROR` is replaced by the daemon's own result string. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: 'Invalid request',
  NO_SESSION: 'No active server configured',
  SESSION_UNAVAILABLE: 'The session could not be restored, check that cookies are enabled',
  RATE_LIMITED: 'Too many requests, try again shortly',
  HOST_NOT_ALLOWED: 'This host is not allowed',
  DNS_FAILED: 'Could not resolve the host name',
  CONNECTION_FAILED: 'Could not connect to the server',
  TIMEOUT: 'The server did not answer in time',
  TLS_FAILED: 'Secure connection failed',
  UNEXPECTED_REDIRECT: 'The server answered with a redirect',
  RESPONSE_TOO_LARGE: 'The server response is too large',
  AUTH_FAILED: 'Authentication failed',
  HTTP_ERROR: 'The server answered with an error',
  SESSION_ID_REJECTED: 'The server rejected the session id',
  RPC_ERROR: 'The server reported an error',
  SERVER_MISCONFIGURED: 'The web server is not configured correctly',
};

/** Error carrying only a code; its message is the fixed text for that code. */
export class OutboundError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = 'OutboundError';
    this.code = code;
  }
}

/** Builds the `{ success: false, error, code }` shape returned by actions. */
export function failure(code: ErrorCode): { success: false; error: string; code: ErrorCode } {
  return { success: false, error: ERROR_MESSAGES[code], code };
}
