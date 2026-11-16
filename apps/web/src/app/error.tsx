'use client';

import '@/lib/i18n';
import { ErrorFallback } from '@shared/components/layout/ErrorFallback';

/**
 * Route-level error screen. The error itself is never rendered (it can carry URLs or daemon text);
 * `reset` re-renders the segment.
 */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback onRetry={reset} />;
}
