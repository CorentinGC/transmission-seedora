# Dependency audit

Triage of `npm audit` (re-run 2026-11-15 after the dependency upgrades of `mi9.18`). Re-run it before each release and after each dependency PR; update this page when the picture changes. Policy: production path first, reachable findings filed in beads at the right priority, build-toolchain findings handled by dependency upgrades.

## Result

| | Start of day | After `npm audit fix` + Electron 40.10.6 | After the upgrades below |
|---|---|---|---|
| Total | 64 (2 critical, 47 high) | 52 (1 critical, 33 high, 11 moderate, 7 low) | 13 (0 critical, 5 high, 8 moderate) |
| `npm audit --omit=dev` | 10 | 9 | 2 (geoip-lite and its `ip-address`) |

Update 2026-11-16: after the `geoip-lite` 2.0.3 upgrade, `npm audit --omit=dev` reports no production advisory.

Gates after each group (typecheck, lint, `npm test` 1224 tests, `i18n:check`, `format:check`, `build:web`) were green; `npm run package` and `npm run make` (macOS dmg and zip) green after the Electron and Forge groups.

## Upgrades applied

| Group | Change |
|---|---|
| In-major updates (lockfile) | react / react-dom 19.2.4 to 19.3.1, i18next 25.8.14 to 25.10.10, react-i18next 16.5.4 to 16.6.6, tailwindcss and `@tailwindcss/*` 4.2.1 to 4.3.5, `@tanstack/react-virtual` 3.13.19 to 3.14.26, zustand 5.0.11 to 5.1.0, `@types/react*` 19.3.0, next 16.4.6 (already current), vitest 5.1.0 (current), plus transitive updates. `package.json` ranges unchanged; the lockfile carries the versions. |
| Electron (`9xk`) | `electron` 40.10.6 to **45.3.2** (exact pin kept), the newest stable line. 41.x and 42.x are out of the upstream support window (Electron supports the latest three majors: 43, 44, 45). `electron` no longer appears in `npm audit`. The `app://` scheme is registered without `corsEnabled`, `bypassCSP` or `allowServiceWorkers`, as the advisories require. Fuses read back from the packaged app are unchanged (all hardened). Breaking changes of 41 to 45 reviewed: none touches the app except the `safeStorage` deprecation below. |
| Electron Forge 8 (`fvm`) | `@electron-forge/*` 7.11.2 to 8.0.1, `@electron/fuses` 1.8.0 to 2.1.3 (required by plugin-fuses 8), `sharp` 0.34.5 to 0.35.5, `vite` 6.4.6 to 8.3.8 (required by plugin-vite 8), `@vitejs/plugin-react` 5.2.0 to 6.3.0 (Vite 8). Required follow-ups: `package.json` `main` is `.vite/build/index.cjs`, the preload is loaded as `preload.cjs`, the `afterCopy` packager hook is promise-based (`forge.config.ts`), `engines.node` was `>=22.17` (Forge 8 floor) and is now `>=24` (see `geoip-lite` below). The critical `tar` advisory and `@electron/rebuild`, `cacache`, `tmp`, `@inquirer/*` are gone. |
| `@ducanh2912/next-pwa` (`0yd`) | Removed from `apps/web`. See below: it generated nothing. |

## Production path

| Package | Severity | Reachable? | Action |
|---|---|---|---|
| `electron` 45.3.2 | none | Fixed by the upgrade. | `9xk` done. The `safeStorage` sync methods (removed in Electron 46) are already replaced by the async API (`src/main/store/secret-crypto.ts`). |
| `geoip-lite` > `ip-address` | high / moderate | Barely: XSS is in HTML-emitting `Address6` methods (not used); the octal and leading-zero SSRF concerns resolvers, while `geoip-lite` only looks an address up in a local database. Input size is bounded by `c07.6`. | **Fixed**, `gt3`: upgraded to `geoip-lite@2.0.3` (2026-11-16), which needs Node 24; owner decision taken: the project moved to Node 24 (`.nvmrc`, `engines`, CI, release workflow, Vercel). The packaged app was checked: `geoipLookup` resolves countries. |
| `@ducanh2912/next-pwa` | none | Removed. | `0yd` done: `next build` uses Turbopack in Next 16 and the plugin only acts in webpack builds, so no `sw.js` or workbox file was ever produced (checked in `apps/web/public` and `.next`). Behaviour is unchanged. `manifest.json` stays static. A real service worker, if wanted, is a separate issue (Serwist needs webpack or `@serwist/turbopack`; mind ADR 0007). |

## Remaining findings (13)

| Root | Severity | Notes |
|---|---|---|
| `@electron-forge/maker-dmg` > `electron-installer-dmg` > `appdmg` > `image-size` (4 packages) | high | ICNS parser DoS in `image-size`; no upstream fix. Build time only, macOS maker, inputs are the repository's own icon. Re-check when `appdmg` moves. |
| `typescript-eslint` > `@typescript-eslint/*` > `minimatch` (6 packages) | moderate | Lint only, runs on trusted files. The suggested `npm audit fix --force` is a downgrade; wait for a typescript-eslint release that bumps `minimatch`. |
| `geoip-lite`, `ip-address` | moderate, high | See the production table. |

## Majors not taken (not security, outside this pass)

`eslint` 10 and `@eslint/js` 10, `typescript` 7, `@commitlint/*` 21, `lint-staged` 17, `chokidar` 6, `lucide-react` 1.x, `i18next` 27 and `react-i18next` 18, `iron-session` 9, `@tanstack/react-table` 9, `https-proxy-agent` 9, `socks-proxy-agent` 10, `esbuild` 0.28 (apps/web dev dependency). Each needs its own changelog review and PR.

## Rules for the next audit

1. `npm audit --json`, then `npm audit --omit=dev --json`; add `electron` by hand to the production list (it is a devDependency but the desktop runtime).
2. Apply what `npm audit fix` offers without `--force`, run the gates (lint, typecheck, tests, `build:web`, `npm run package`).
3. Every remaining production-path item gets a beads issue; majors go to their own issue.
