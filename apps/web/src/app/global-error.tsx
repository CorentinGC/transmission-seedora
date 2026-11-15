'use client';

import './globals.css';
import '@/lib/i18n';
import { ErrorFallback } from '@shared/components/layout/ErrorFallback';

/**
 * Last-resort error screen that replaces the root layout, so it brings its own `<html>`, `<body>`
 * and styles. The error is never rendered; `reset` re-renders the root.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div className="h-screen">
          <ErrorFallback onRetry={reset} />
        </div>
      </body>
    </html>
  );
}
