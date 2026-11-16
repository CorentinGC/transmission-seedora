import { PHASE_PRODUCTION_BUILD } from 'next/constants';

/**
 * Next.js instrumentation hook: fails the server start when the deployment is misconfigured
 * (missing `COOKIE_SECRET` in production). Skipped during `next build`, which has no secrets.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  const { assertServerConfig } = await import('./lib/server/env');
  assertServerConfig();
}
