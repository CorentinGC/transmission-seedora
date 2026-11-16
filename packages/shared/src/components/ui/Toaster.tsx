import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useNotificationStore, type AppNotification } from '../../stores/notification-store';
import { Button } from './Button';

const AUTO_DISMISS_MS = 8000;

function Toast({ notification }: { notification: AppNotification }) {
  const { t } = useTranslation();
  const dismiss = useNotificationStore((s) => s.dismiss);
  const { id, messageKey, params } = notification;

  // Hovering or focusing the toast pauses auto-dismiss so it can be read and its button reached.
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const holding = paused || focused;

  useEffect(() => {
    if (holding) return;
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, dismiss, holding]);

  const error = typeof params.error === 'string' && params.error ? params.error : t('notification.unknownError');

  return (
    <div
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      className="flex items-start gap-2 rounded-md border border-destructive bg-card px-3 py-2 text-xs text-card-foreground shadow-md"
    >
      <span className="flex-1 break-words">{t(messageKey, { ...params, error })}</span>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => dismiss(id)}
        aria-label={t('notification.dismiss')}
        title={t('notification.dismiss')}
        className="p-1 h-5 w-5 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X size={12} aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Stack of error notifications queued through `useNotificationStore`. */
export function Toaster() {
  const notifications = useNotificationStore((s) => s.notifications);
  if (notifications.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-8 right-3 z-50 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-2 [&>*]:pointer-events-auto">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} />
      ))}
    </div>
  );
}
