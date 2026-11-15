import { create } from 'zustand';
import { describeFailure, isCancelled } from '../lib/error-messages';

export interface AppNotification {
  id: number;
  /** i18n key, translated at render time. */
  messageKey: string;
  params: Record<string, string | number>;
}

interface NotificationStore {
  notifications: AppNotification[];
  /** Shows an error notification; an identical one already on screen is not duplicated. */
  notify: (messageKey: string, params?: Record<string, string | number>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Queue of user-visible error notifications, rendered by `Toaster`. */
export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  notify: (messageKey, params = {}) => {
    set((state) => {
      const serialized = JSON.stringify(params);
      const duplicate = state.notifications.some(
        (n) => n.messageKey === messageKey && JSON.stringify(n.params) === serialized,
      );
      if (duplicate) return state;
      return { notifications: [...state.notifications, { id: nextId++, messageKey, params }] };
    });
  },

  dismiss: (id) => {
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
  },
}));

/**
 * Reports a failed operation. The reason is the translated message for a known failure `code`,
 * otherwise the daemon/platform error text (or a generic fallback). A cancellation stays silent.
 */
export function notifyFailure(messageKey: string, error: string | undefined, code?: string): void {
  if (isCancelled(code)) return;
  useNotificationStore.getState().notify(messageKey, { error: describeFailure(error, code) });
}
