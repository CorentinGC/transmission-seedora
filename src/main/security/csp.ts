/**
 * Content-Security-Policy for the Electron renderer. The production policy is strict;
 * the development policy adds what the Vite dev server needs (inline React refresh preamble, HMR socket).
 */
export function buildRendererCsp(isDev: boolean): string {
  const directives: Record<string, string> = {
    'default-src': "'self'",
    'script-src': isDev ? "'self' 'unsafe-inline'" : "'self'",
    'style-src': "'self' 'unsafe-inline'",
    'img-src': "'self' data: blob:",
    'font-src': "'self' data:",
    'connect-src': isDev ? "'self' ws://localhost:* http://localhost:*" : "'self'",
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': "'none'",
    'frame-src': "'none'",
    'worker-src': "'self' blob:",
  };
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join('; ');
}

/** Marker in `index.html` that the build replaces with the CSP meta tag. */
export const CSP_MARKER = '<!--seedora-csp-->';

/** Replaces the CSP marker in `html` with the CSP meta tag. Throws when the marker is missing, so a build can never ship without a policy. */
export function injectCspMeta(html: string, isDev: boolean): string {
  if (!html.includes(CSP_MARKER))
    throw new Error(`index.html is missing the ${CSP_MARKER} marker; refusing to build without a CSP`);
  return html.replace(CSP_MARKER, `<meta http-equiv="Content-Security-Policy" content="${buildRendererCsp(isDev)}" />`);
}
