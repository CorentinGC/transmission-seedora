import { protocol } from 'electron';
import { APP_SCHEME, buildAppManifest, createAppRequestHandler } from './app-protocol';

/**
 * Declares the `app://` scheme. Must run before the `ready` event. Deliberately no `corsEnabled`,
 * `bypassCSP`, `allowServiceWorkers` or `stream`: the page stays under its own CSP and same-origin rules.
 */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    // supportFetchAPI is unverified-removable: nothing in the renderer is known to fetch() an app:// URL,
    // but removal cannot be confirmed without running the packaged app, so it stays on.
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Loads the renderer build in `rootDir` into memory once and serves it on `app://`. Must run after `ready`. */
export function serveRendererFrom(rootDir: string): void {
  protocol.handle(APP_SCHEME, createAppRequestHandler(buildAppManifest(rootDir)));
}
