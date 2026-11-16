import fs from 'node:fs';
import path from 'node:path';
import { buildRendererCsp } from './csp';

/** Custom scheme the packaged renderer is served from. */
export const APP_SCHEME = 'app';
/** Fixed host of the packaged renderer; together with the scheme it forms the only trusted packaged origin. */
export const APP_HOST = 'seedora';
/** Origin of the packaged renderer. */
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
/** URL the packaged window loads. */
export const APP_INDEX_URL = `${APP_ORIGIN}/index.html`;

const MAX_ASSET_BYTES = 64 * 1024 * 1024;
/** Longest URL pathname accepted; the renderer build never produces anything close. */
const MAX_PATHNAME_LENGTH = 1024;

/** Only these file types are ever served (what the renderer build emits); anything else is a 404. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/** One immutable, in-memory file of the renderer build. */
export interface AppManifestEntry {
  body: Uint8Array;
  contentType: string;
}

/** Everything the `app://` scheme can serve, keyed by URL pathname (`/assets/a.js`). Built once at `ready`. */
export type AppManifest = ReadonlyMap<string, AppManifestEntry>;

/**
 * Walks `rootDir` once and loads every allow-listed regular file into memory. Symlinks (files or
 * directories) are never followed or listed. Reads go through `fs.readFileSync`, which in a packaged app is
 * the integrity-checked asar read. Throws when the build has no `index.html`.
 */
export function buildAppManifest(rootDir: string): AppManifest {
  const manifest = new Map<string, AppManifestEntry>();
  const walk = (dir: string, urlPrefix: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const urlPath = `${urlPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(absolute, urlPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const contentType = CONTENT_TYPES[path.extname(entry.name).toLowerCase()];
      if (!contentType) continue;
      const body = fs.readFileSync(absolute);
      if (body.byteLength > MAX_ASSET_BYTES) continue;
      manifest.set(urlPath, { body: new Uint8Array(body), contentType });
    }
  };
  walk(rootDir, '');
  if (!manifest.has('/index.html')) throw new Error('Renderer build is missing index.html');
  return manifest;
}

/**
 * Turns a request URL of the `app://` scheme into a manifest key (URL pathname), or null when the request
 * is not a plain path. Rejects: other scheme or host, credentials or port, over-long paths, backslashes,
 * NUL, encoded separators, `.`/`..`/empty segments (also after one decoding) and residual `%` (double encoding).
 */
export function resolveAppPath(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.hostname !== APP_HOST) return null;
  if (url.port !== '' || url.username !== '' || url.password !== '') return null;
  if (url.pathname.length > MAX_PATHNAME_LENGTH) return null;

  const rawPath = url.pathname === '/' ? '/index.html' : url.pathname;
  if (rawPath.includes('\\')) return null;
  const decoded: string[] = [];
  for (const segment of rawPath.split('/').slice(1)) {
    let value: string;
    try {
      value = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (value === '' || value === '.' || value === '..') return null;
    if (/[\\/\0%]/.test(value)) return null;
    decoded.push(value);
  }
  return `/${decoded.join('/')}`;
}

/** CSP sent with every `app://` response: the packaged policy, plus a ban on framing the app. */
const RESPONSE_CSP = `${buildRendererCsp(false)}; frame-ancestors 'none'`;

/**
 * Builds the `app://` request handler serving `manifest`. GET and HEAD only; every failure is an opaque 404
 * (no path or error detail leaks to the page). Every response, errors included, carries the CSP.
 */
export function createAppRequestHandler(manifest: AppManifest): (request: Request) => Response {
  const baseHeaders = { 'Content-Security-Policy': RESPONSE_CSP, 'X-Content-Type-Options': 'nosniff' };
  const notFound = () => new Response('Not found', { status: 404, headers: baseHeaders });
  return (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { ...baseHeaders, Allow: 'GET, HEAD' } });
    }
    const urlPath = resolveAppPath(request.url);
    const entry = urlPath === null ? undefined : manifest.get(urlPath);
    if (!entry) return notFound();
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(entry.body), {
      status: 200,
      headers: { ...baseHeaders, 'Content-Type': entry.contentType },
    });
  };
}
