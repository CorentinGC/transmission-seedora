# 0006 — Packaged renderer served from the privileged `app://seedora` scheme

- **Status:** Accepted (2026-11-15)
- **Date:** 2026-11-15
- **Issue:** seedora-transmission-0mk

## Context

The packaged Electron app used to load its renderer with `loadFile`, so the page origin was `file://`. Facts that constrain the answer:

- **A CSP `'self'` means nothing on `file://`.** `file:` URLs have no meaningful origin of their own, so `connect-src 'self'` does not isolate the page from the local disk. With the `GrantFileProtocolExtraPrivileges` fuse on, `file://` pages also get extra privileges.
- **The IPC sender check needs an origin to trust.** Every handler checks the sender frame. On `file://` the only available rule is "any file URL", which would also trust any local HTML file the window could be made to load.
- **Trust should not depend on the install path.** Matching a `file:` URL against the app's install directory is fragile across platforms.
- The renderer is untrusted: it displays daemon-supplied strings, and a script injection must not be able to read local files or reach the network.

## Decision

The packaged window loads `app://seedora/index.html`. The development window keeps loading the Vite dev server URL.

- The scheme is declared with `protocol.registerSchemesAsPrivileged` before `ready` (`src/main/security/app-scheme.ts`) with only `standard`, `secure` and `supportFetchAPI`. It never gets `corsEnabled`, `bypassCSP`, `allowServiceWorkers` or `stream`.
- A handler registered with `protocol.handle` after `ready` serves the renderer build directory (`src/main/security/app-protocol.ts`). It answers GET and HEAD only (405 otherwise). A request is served only if the URL has the scheme `app` and the host `seedora`, carries no port or credentials, has no empty, `.` or `..` segment (also after one decoding), no backslash, NUL, encoded separator or residual `%`, ends in an allow-listed extension, and its real path (symlinks resolved) stays inside the build directory. Files are read with `readRegularFile` and a size cap. Every failure is an opaque 404.
- The trusted origins are `app://seedora` in a packaged build and the dev server URL in development. **No `file:` URL is ever trusted**, for the sender check, the navigation guards and the permission handlers (`src/main/security/sender.ts`).
- The `GrantFileProtocolExtraPrivileges` fuse is disabled, since nothing needs `file://` any more.
- The CSP is a `<meta http-equiv>` tag injected into `index.html` at build time, with `connect-src 'self'` in production (`src/main/security/csp.ts`, `cspPlugin` in `vite.renderer.config.ts`).

## Consequences

- `connect-src 'self'` is enforced against a real origin: the renderer cannot contact the network, and `fetch('file://...')` is blocked. Verified in a packaged build: `file://` fetch blocked, path traversal returns 404, `POST` returns 405, an unapproved `readFileBase64` is refused.
- The renderer's storage origin changes from `file://` to `app://seedora`. Renderer-only `localStorage` written by earlier builds is not carried over and resets once. Servers and preferences are stored by the main process in `config.json` and are unaffected.
- Web APIs that need a secure context work on `app://` because the scheme is declared `secure`.
- The handler is new code on the trust boundary: it must keep its tests (`src/main/security/app-protocol.test.ts`) and a `security-auditor` pass on any change. Never serve from `file:` again and never add the privileges listed above to the scheme.
- Only one packaged build, on macOS, has been verified. Windows and Linux are tracked in `2df`.

## Alternatives considered

- **Keep `file://` and tighten the sender check by path.** Rejected: a path prefix check is fragile across platforms, and the CSP origin problem remains.
- **A local HTTP server on a random port.** Rejected: it opens a network listener reachable by other local processes and other users, and needs a per-run secret to be safe.
