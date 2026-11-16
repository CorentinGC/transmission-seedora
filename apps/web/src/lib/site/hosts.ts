/**
 * Host-based routing between the marketing site (seedora.app) and the web app (app.seedora.app).
 * Pure functions so the rules are unit-tested; `src/proxy.ts` applies them (ADR 0008).
 */

export const SITE_ORIGIN = 'https://seedora.app';
export const APP_ORIGIN = 'https://app.seedora.app';

/** Landing languages, in sitemap order. */
export const LANDING_LANGS = ['en', 'fr'] as const;
export type LandingLang = (typeof LANDING_LANGS)[number];

export type HostRole = 'site' | 'site-www' | 'app';

/** Classifies a Host header: the apex is the site, www redirects to it, anything else serves the app. */
export function classifyHost(host: string | null): HostRole {
  const name = (host ?? '').split(':')[0]?.toLowerCase() ?? '';
  if (name === 'seedora.app') return 'site';
  if (name === 'www.seedora.app') return 'site-www';
  return 'app';
}

export type RouteDecision =
  { kind: 'next' } | { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; url: string };

/** Paths the site host serves from the shared static/asset set without rewriting. */
const PASS_THROUGH =
  /^\/(landing\/|icons\/|robots\.txt$|sitemap\.xml$|favicon\.ico$|apple-touch-icon\.png$|manifest\.json$)/;

/** Decides what to do with a request, from its host and path. */
export function decideRoute(host: string | null, pathname: string): RouteDecision {
  const role = classifyHost(host);
  if (role === 'app') return { kind: 'next' };
  if (role === 'site-www') return { kind: 'redirect', url: `${SITE_ORIGIN}${pathname}` };
  if (PASS_THROUGH.test(pathname)) return { kind: 'next' };
  if (pathname === '/') return { kind: 'rewrite', pathname: '/landing/en' };
  const lang = LANDING_LANGS.find((candidate) => pathname === `/${candidate}`);
  if (lang) return { kind: 'rewrite', pathname: `/landing/${lang}` };
  return { kind: 'redirect', url: APP_ORIGIN + pathname };
}
