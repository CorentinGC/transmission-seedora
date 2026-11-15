import { useTranslation } from 'react-i18next';
import { Button } from '../ui';

interface ErrorFallbackProps {
  /** Re-renders the failed subtree. */
  onRetry: () => void;
  /** Reloads the whole page; defaults to `window.location.reload()`. */
  onReload?: () => void;
}

/**
 * Recoverable error screen. Deliberately never renders the error message or
 * stack: they can carry URLs, credentials or daemon-supplied text.
 */
export function ErrorFallback({ onRetry, onReload = () => window.location.reload() }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <h1 className="text-lg font-semibold">{t('errorBoundary.title')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('errorBoundary.description')}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={onRetry}>{t('errorBoundary.retry')}</Button>
        <Button onClick={onReload}>{t('errorBoundary.reload')}</Button>
      </div>
    </div>
  );
}
