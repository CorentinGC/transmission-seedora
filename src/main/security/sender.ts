/** Minimal view of an IPC event's sender frame (keeps this module testable without Electron). */
export interface SenderEventLike {
  senderFrame: { url: string; parent?: unknown } | null;
}

/** Where the trusted renderer is served from. */
export interface TrustedOrigins {
  /** Vite dev server URL (development only). */
  devServerUrl?: string;
  /** Origin of the packaged renderer (`app://seedora`). Never a `file:` URL. */
  appOrigin?: string;
}

/** Scheme, host and port of a URL, or null when it cannot be parsed or carries credentials. Works for non-special schemes (`new URL().origin` is "null" for those). */
function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || !parsed.host) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/** Returns true when `url` belongs to the app's own origin (dev server or packaged `app://seedora`). `file:` is never trusted. */
export function isTrustedUrl(url: string, origins: TrustedOrigins): boolean {
  const origin = originOf(url);
  if (!origin || origin.startsWith('file:')) return false;
  return [origins.devServerUrl, origins.appOrigin].some(
    (trusted) => trusted !== undefined && originOf(trusted) === origin,
  );
}

/** Builds the sender check used by every IPC handler: top-level frame, app URL only. */
export function createSenderValidator(origins: TrustedOrigins): (event: SenderEventLike) => boolean {
  return (event) => {
    const frame = event.senderFrame;
    if (!frame || frame.parent) return false;
    return isTrustedUrl(frame.url, origins);
  };
}

/**
 * Builds the trusted origins from the build mode: the dev server in development, `appOrigin` in a packaged
 * build. A packaged build that carries a dev server URL is a misbuild and throws instead of trusting it.
 */
export function buildTrustedOrigins(
  devServerUrl: string | undefined,
  isPackaged: boolean,
  appOrigin: string,
): TrustedOrigins {
  if (isPackaged && devServerUrl) throw new Error('Packaged build must not carry a dev server URL');
  return devServerUrl ? { devServerUrl, appOrigin: undefined } : { devServerUrl: undefined, appOrigin };
}
