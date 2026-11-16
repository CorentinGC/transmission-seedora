import { NextResponse, type NextRequest } from 'next/server';
import { classifyHost, decideRoute } from './lib/site/hosts';

/**
 * Splits one deployment into the marketing site (seedora.app) and the app (app.seedora.app) by host,
 * and keeps the app host out of search results (ADR 0008).
 */
export function proxy(request: NextRequest): NextResponse {
  const host = request.headers.get('host');
  const decision = decideRoute(host, request.nextUrl.pathname);
  if (decision.kind === 'redirect') return NextResponse.redirect(decision.url, 308);
  const response =
    decision.kind === 'rewrite' ? NextResponse.rewrite(new URL(decision.pathname, request.url)) : NextResponse.next();
  if (classifyHost(host) === 'app') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: ['/((?!_next/|.*\\.(?:png|jpg|svg|webp|ico|json)$).*)'],
};
