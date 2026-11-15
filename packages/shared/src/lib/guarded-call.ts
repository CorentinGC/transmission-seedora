import i18n from 'i18next';
import type { IpcResponse } from '../types';
import { errorCodeKey, isCancelled } from './error-messages';
import { useNotificationStore } from '../stores/notification-store';

/**
 * Awaits a platform call that reports failure as `{ success: false }` or by throwing.
 * On failure it queues the translated `messageKey` (never the raw platform error text),
 * followed by the translated reason when the response carries a known failure `code`,
 * and resolves null. A cancelled action (`code: 'CANCELLED'`) resolves null silently; on success it resolves the response.
 */
export async function guardedCall<T>(
  call: () => Promise<IpcResponse<T>>,
  messageKey: string,
): Promise<IpcResponse<T> | null> {
  try {
    const res = await call();
    if (res.success) return res;
    if (isCancelled(res.code)) return null;
    const reasonKey = errorCodeKey(res.code);
    if (reasonKey) {
      useNotificationStore
        .getState()
        .notify('notification.withReason', { message: i18n.t(messageKey), reason: i18n.t(reasonKey) });
      return null;
    }
  } catch {
    // fall through to the notification below
  }
  useNotificationStore.getState().notify(messageKey);
  return null;
}
