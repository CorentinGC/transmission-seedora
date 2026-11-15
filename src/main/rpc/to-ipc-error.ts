import type { IpcResponse } from '@shared/types';
import { RpcError } from './client';

/**
 * Turns anything thrown while talking to the daemon into a response that is safe for the renderer:
 * an `RpcError` carries a credential-free message and a stable `code`; any other error is reduced to a
 * fixed message (its text could echo a URL, a proxy address or credentials).
 */
export function toIpcError(err: unknown): IpcResponse<never> {
  if (err instanceof RpcError) return { success: false, error: err.message, code: err.code };
  console.error('[RPC] Unexpected failure:', err instanceof Error ? err.name : 'unknown error');
  return { success: false, error: 'Request failed', code: 'UNKNOWN' };
}
