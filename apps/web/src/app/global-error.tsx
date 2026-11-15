'use client';

import './globals.css';
import '@/lib/i18n';
import { useApplyTheme } from '@shared/hooks/useApplyTheme';
import { ErrorFallback } from '@shared/components/layout/ErrorFallback';

/**
 * Last-resort error screen that replaces the root layout, so it brings its own `<html>`, `<body>`
 * and styles. The error is never rendered; `reset` re-renders the root.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // The root layout (and the app bootstrap that applies the theme) is gone: apply it here.
  useApplyTheme();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="h-screen">
          <ErrorFallback onRetry={reset} />
        </div>
      </body>
    </html>
  );
}
