import { app, session, type WebContents } from 'electron';
import { isTrustedUrl, type TrustedOrigins } from './sender';

const ALLOWED_PERMISSION = 'clipboard-sanitized-write';

/**
 * Denies every permission request and check (camera, geolocation, notifications API, ...).
 * Only clipboard text writes (copy magnet link) are granted, and only to the app's own page.
 */
export function denyAllPermissions(origins: TrustedOrigins): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(permission === ALLOWED_PERMISSION && isTrustedUrl(details.requestingUrl, origins)),
  );
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) =>
    permission === ALLOWED_PERMISSION && isTrustedUrl(details.requestingUrl ?? requestingOrigin, origins),
  );
  ses.setDevicePermissionHandler(() => false);
}

/**
 * Builds the listener shared by `will-navigate`, `will-redirect` and `will-frame-navigate`: it cancels any
 * navigation (top-level or subframe) whose target is not the app's own origin.
 */
export function createNavigationGuard(origins: TrustedOrigins): (event: { preventDefault: () => void }, url: string) => void {
  return (event, url) => {
    if (!isTrustedUrl(url, origins)) event.preventDefault();
  };
}

/**
 * Applies navigation guards to every web contents ever created: no navigation away from the app page,
 * no redirects, no new windows, no webviews. In a packaged build DevTools are closed immediately.
 */
export function guardWebContents(origins: TrustedOrigins): void {
  app.on('web-contents-created', (_event, contents: WebContents) => {
    const blockForeign = createNavigationGuard(origins);
    contents.on('will-navigate', blockForeign);
    contents.on('will-redirect', blockForeign);
    contents.on('will-frame-navigate', (event) => blockForeign(event, event.url));
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    if (app.isPackaged) contents.on('devtools-opened', () => contents.closeDevTools());
  });
}
