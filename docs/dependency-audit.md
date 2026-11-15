# Dependency audit

Triage of `npm audit` (run 2026-11-15). Re-run it before each release and after each dependency PR; update this page when the picture changes. Policy: production path first, reachable findings filed in beads at the right priority, build-toolchain findings handled by dependency upgrades.

## Result

| | Before | After `npm audit fix` + Electron 40.10.6 |
|---|---|---|
| Total | 64 (2 critical, 47 high) | 52 (1 critical, 33 high, 11 moderate, 7 low) |
| `npm audit --omit=dev` | 10 | 9 (2 high, 3 moderate, 4 low) |

Applied (non-breaking, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build:web` and `npm run package` green): in-range lockfile updates (vite stays 6.x, Electron Forge 7.11.1 to 7.11.2, babel, brace-expansion, picomatch, fs-extra, `@xmldom/xmldom`), and `electron` 40.7.0 to 40.10.6 (a patch of the same major; it ships to users, so it is a `fix`-type change).

`npm audit --omit=dev` is not the production path: **`electron` is a devDependency but is the runtime every desktop user runs.** Classify it as production.

## Production path

| Package | Severity | Reachable? | Action |
|---|---|---|---|
| `electron` 40.10.6 | high (remaining) | Yes, in principle. The remaining advisories are only fixed in Electron 41.10.6+ / 42.11.16 (custom protocol and file/HTTP handlers cross-origin reads without `corsEnabled`, sandboxed popups, `<webview>` workers, certificate mitigation, several permission-origin attributions). The app serves its renderer from `app://seedora` with a sandbox and no `<webview>`, which limits several of them, but the fix is the upgrade. | File `seedora-transmission-9xk` (P1, blocks release readiness), done with `mi9.18`. |
| `geoip-lite` > `ip-address` | high / moderate | Barely: XSS is in HTML-emitting `Address6` methods (not used); the octal/decimal leading-zero SSRF concerns resolvers, while `geoip-lite` only looks an address up in a local database. Input size is bounded by `c07.6`. | Fixed by `geoip-lite@2.0.3` (major), file `seedora-transmission-gt3` (P3). |
| `@ducanh2912/next-pwa` > `workbox-build` > `serialize-javascript`, `deepmerge`, `@rollup/*` | high / moderate / low | No at runtime: these run at build time to generate the service worker; no untrusted input reaches them. | No upstream fix; track `@ducanh2912/next-pwa` (unmaintained) in `seedora-transmission-0yd` (P3). |

## Build toolchain only (not shipped)

About 42 of the 52 advisories sit behind these roots and never reach a user:

- `@electron-forge/*` (7.x): `tar` (the only critical), `@electron/rebuild`, `@electron/node-gyp`, `cacache`, `make-fetch-happen`, `tmp`, `@inquirer/*`, `appdmg`. They run on the maintainer's or CI's machine against trusted inputs. Fix: Electron Forge 8 (major), file `seedora-transmission-fvm` (P2), done with `mi9.18`.
- `sharp`: used by `scripts/generate-icons.mjs` on repository-owned PNGs only. Fix: `sharp@0.35.x`, bundled into `frg`.
- `typescript-eslint` > `minimatch`: lint only.
- `vite` dev server (the `vite` advisories apply to a dev server that is reachable only on localhost during development).

## Rules for the next audit

1. `npm audit --json`, then `npm audit --omit=dev --json`; add `electron` by hand to the production list.
2. Apply what `npm audit fix` offers without `--force`, run the gates (lint, typecheck, tests, `build:web`, `npm run package`).
3. Every remaining production-path item gets a beads issue; majors go to `mi9.18`.
