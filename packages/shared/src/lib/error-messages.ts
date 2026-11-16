import i18n from 'i18next';

/** Codes raised by the web server actions and the client-side web API (apps/web `ERROR_CODES`). */
const WEB_CODES = new Set([
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
  'SERVER_NOT_FOUND',
  'IMPORT_INVALID',
]);

/** Transport and handler codes raised by the Electron main process (`RpcErrorCode` plus `UNKNOWN`); `TIMEOUT` and `HTTP_ERROR` are shared with the web set. */
const RPC_CODES = new Set([
  'TLS_UNTRUSTED',
  'TLS_EXPIRED',
  'TLS_HOSTNAME',
  'NETWORK',
  'TOO_LARGE',
  'AUTH',
  'INVALID_RESPONSE',
  'SESSION',
  'RPC_FAILURE',
  'NO_CONNECTION',
  'UNKNOWN',
  'SECRET_STORE_FAILED',
  'CONFIG_UNWRITABLE',
]);

/** Failure code for an action the user declined or cancelled; it is never reported as an error. */
export const CANCELLED_CODE = 'CANCELLED';

/** True when a failure is the user's own cancellation, which must stay silent. */
export function isCancelled(code: string | undefined): boolean {
  return code === CANCELLED_CODE;
}

/** Locale key of the translated message for a failure code, or null when the code is unknown or absent. */
export function errorCodeKey(code: string | undefined): string | null {
  if (!code) return null;
  if (WEB_CODES.has(code)) return `errors.web.${code}`;
  if (RPC_CODES.has(code)) return `errors.rpc.${code}`;
  return null;
}

/**
 * Text describing a failed call: the translated message for a known `code`, otherwise the
 * daemon's own `error` text, otherwise a generic "unknown error".
 */
export function describeFailure(error: string | undefined, code?: string): string {
  const key = errorCodeKey(code);
  if (key) return i18n.t(key);
  return error || i18n.t('notification.unknownError');
}
