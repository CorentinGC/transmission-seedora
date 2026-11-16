import { describe, expect, it } from 'vitest';
import { buildRendererCsp, CSP_MARKER, injectCspMeta } from './csp';

describe('buildRendererCsp', () => {
  it('is strict in production', () => {
    const csp = buildRendererCsp(false);
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('ws:');
  });

  it('allows the Vite dev server in development only', () => {
    const csp = buildRendererCsp(true);
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain('ws://localhost:*');
  });
});

describe('injectCspMeta', () => {
  it('replaces the marker with the CSP meta tag', () => {
    const html = injectCspMeta('<head><!--seedora-csp--></head>', false);
    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).not.toContain(CSP_MARKER);
  });

  it('throws when the marker is missing', () => {
    expect(() => injectCspMeta('<head></head>', false)).toThrow(/marker/);
  });
});
