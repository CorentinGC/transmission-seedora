# 0007 — Nonce-based CSP for the web app: not adopted

- **Status:** Accepted (2026-11-15). Confirms [ADR 0005](0005-web-security-headers.md); does not supersede it.
- **Date:** 2026-11-15
- **Issue:** seedora-transmission-c07.17

## Context

ADR 0005 shipped a static CSP with `script-src 'self' 'unsafe-inline'` and asked for a follow-up: would a per-request nonce (`'nonce-…' 'strict-dynamic'`) be worth its cost? This decision was made from the Next 16 documentation shipped in `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` and from the app's structure. No nonce policy was run in a browser: the check below is by analysis.

Facts:

- A nonce is generated per request in `proxy.ts` and applied by Next while it renders. The guide states the page "must be **dynamically rendered**". Seedora's single route is a static shell (`page.tsx` renders the client app with `ssr: false`); a nonce would turn every page load into a function invocation and remove CDN caching of the shell.
- The service worker (`@ducanh2912/next-pwa`) precaches the shell. A cached HTML document carries the nonce it was rendered with, while the `Content-Security-Policy` header of a later navigation carries a new one. Scripts in the cached document would be blocked, so the PWA would have to stop precaching the document or be given a fetch strategy that always hits the network. That breaks offline start, which is a PWA feature.
- Next documents an experimental hash-based alternative (`experimental.sri`) that keeps static generation. It hashes the script files; it is experimental and "cannot handle dynamically generated scripts". The inline RSC payload scripts Next injects into the document are not files, so it is not established that `script-src 'self'` without `'unsafe-inline'` would let the page hydrate. Not tested here.
- What a nonce would buy: `'unsafe-inline'` only matters if an attacker can already inject markup. The app has no injection sink (daemon strings are React text; no `dangerouslySetInnerHTML`, `eval`, `new Function`), `script-src-attr 'none'` blocks inline handlers, and `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'` and `frame-ancestors 'none'` stay in force.
- The larger exposure is not the CSP: the client keeps server passwords in `localStorage` (`c07.8`; exports now omit them by default). A nonce policy would not change that.

## Decision

Keep the static policy of ADR 0005. Do not add a `proxy.ts`.

`style-src 'self' 'unsafe-inline'` stays too. React and some shared UI components set inline `style` attributes (virtualised list positioning, column sizing); `style-src` nonces do not cover attributes, so dropping `'unsafe-inline'` would break the layout. Style injection can hide or restyle content but cannot run script, and the exfiltration channels are closed by the other directives.

Revisit when one of these holds:

1. Next's SRI support leaves experimental and is shown to let the page hydrate under `script-src 'self'`.
2. The app gains an XSS-prone feature (rendering daemon-supplied HTML, user links, a third-party embed).
3. The shell must render per request anyway (server-rendered, per-user content), which removes the main cost of nonces.

## Consequences

- The residual risk "CSP allows inline scripts" stays listed in `docs/security.md` with this rationale.
- No stale-nonce interaction with the service worker, no per-page-load function invocation.
- A future evaluation starts from the three triggers above, not from the cost analysis, which is settled.
