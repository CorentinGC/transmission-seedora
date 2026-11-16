# 0008 — Landing site and app subdomain

Status: accepted (2026-11-16)

## Context

`seedora.app` served the web app directly. The project needs a public landing page (value proposition, screenshots, downloads) that search engines can index, and the app, which is a client-only SPA full of user state, should not compete with it.

## Decision

- One Vercel project and one Next.js deployment (`apps/web`) serve both hosts. A `src/proxy.ts` routes by `Host` using the pure rules in `src/lib/site/hosts.ts`:
  - `seedora.app`: `/` and `/fr` are rewritten to the static landing routes `/landing/en` and `/landing/fr`; any other path is redirected (308) to `app.seedora.app`.
  - `www.seedora.app`: redirected (308) to the apex.
  - every other host (`app.seedora.app`, previews, localhost): the app, as before, with `X-Robots-Tag: noindex, nofollow`.
- The landing is a server component without client JavaScript. Its copy (EN, FR) lives in `src/lib/site/content.ts`; it is marketing text, separate from the 23 in-app locales. It is light-themed only (the theme is class-driven in the app).
- SEO: per-language canonical and hreflang, Open Graph, JSON-LD `SoftwareApplication`, `sitemap.xml`, host-aware `robots.txt` (the app host disallows everything).
- DNS stays on Cloudflare/Vercel as configured by the owner; `app.seedora.app` is added as a project domain.

## Consequences

- Browser-local state (servers stored in `localStorage`) and the session cookie are per origin: users of the old `seedora.app/` app start empty on `app.seedora.app` and re-import their config.
- No new dependency, no second project to deploy. The CSP is unchanged (same-origin assets only).
- Adding a landing language means a new entry in `LANDING_LANGS`, `LANDING_CONTENT` and the sitemap.
