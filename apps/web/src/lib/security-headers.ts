/**
 * Security response headers for the web app (ADR 0005).
 *
 * A static policy: `'unsafe-inline'` for scripts keeps the page static and
 * compatible with the service worker's precache (Next injects inline RSC
 * payload scripts), while inline event-handler attributes stay blocked. Everything else stays same-origin. Any new third-party
 * origin needs a CSP change reviewed by security-auditor.
 */

export type SecurityEnvironment = 'production' | 'development' | 'preview';

export interface HeaderEntry {
  key: string;
  value: string;
}

const VERCEL_LIVE = 'https://vercel.live';

/** Picks the header profile from the process environment. Fails closed to production. */
export function resolveSecurityEnvironment(env: {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}): SecurityEnvironment {
  if (env.NODE_ENV === 'development') return 'development';
  if (env.VERCEL_ENV === 'preview') return 'preview';
  return 'production';
}

/** Builds the Content-Security-Policy value for an environment. */
export function buildContentSecurityPolicy(environment: SecurityEnvironment): string {
  const dev = environment === 'development';
  const preview = environment === 'preview';
  const live = preview ? ` ${VERCEL_LIVE}` : '';

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}${live}`,
    "script-src-attr 'none'",
    `style-src 'self' 'unsafe-inline'${live}`,
    `img-src 'self' data: blob:${live}`,
    `font-src 'self' data:${live}`,
    `connect-src 'self'${dev ? ' ws:' : ''}${live}`,
    ...(preview ? [`frame-src ${VERCEL_LIVE}`] : []),
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}

/** Builds the full header list. HSTS is omitted in development (plain HTTP). */
export function buildSecurityHeaders(environment: SecurityEnvironment): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(environment) },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    },
  ];
  if (environment !== 'development') {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' });
  }
  return headers;
}
