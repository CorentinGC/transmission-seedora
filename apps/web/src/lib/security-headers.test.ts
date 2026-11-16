import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, buildSecurityHeaders } from './security-headers';

const value = (headers: { key: string; value: string }[], key: string) => headers.find((h) => h.key === key)?.value;

const directive = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `) || d === name);

describe('buildContentSecurityPolicy', () => {
  it('production is the static ADR 0005 policy', () => {
    expect(buildContentSecurityPolicy('production')).toBe(
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
  });

  it('production has no eval, no websockets, no vercel.live, no upgrade-insecure-requests', () => {
    const csp = buildContentSecurityPolicy('production');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('ws:');
    expect(csp).not.toContain('vercel.live');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('development adds unsafe-eval and ws: only', () => {
    const csp = buildContentSecurityPolicy('development');
    expect(directive(csp, 'script-src')).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' ws:");
    expect(csp).not.toContain('vercel.live');
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('preview adds vercel.live to the toolbar directives, without eval', () => {
    const csp = buildContentSecurityPolicy('preview');
    for (const name of ['script-src', 'connect-src', 'img-src', 'style-src', 'font-src', 'frame-src']) {
      expect(directive(csp, name)).toContain('https://vercel.live');
    }
    expect(csp).not.toContain('unsafe-eval');
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('keeps the non-negotiable directives in every environment', () => {
    for (const env of ['production', 'development', 'preview'] as const) {
      const csp = buildContentSecurityPolicy(env);
      expect(directive(csp, 'object-src')).toBe("object-src 'none'");
      expect(directive(csp, 'base-uri')).toBe("base-uri 'none'");
      expect(directive(csp, 'default-src')).toBe("default-src 'self'");
      expect(directive(csp, 'script-src-attr')).toBe("script-src-attr 'none'");
    }
  });
});

describe('buildSecurityHeaders', () => {
  it('production sends every header including HSTS without preload', () => {
    const headers = buildSecurityHeaders('production');
    expect(value(headers, 'Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains');
    expect(value(headers, 'X-Frame-Options')).toBe('DENY');
    expect(value(headers, 'X-Content-Type-Options')).toBe('nosniff');
    expect(value(headers, 'Referrer-Policy')).toBe('no-referrer');
    expect(value(headers, 'Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(value(headers, 'Cross-Origin-Resource-Policy')).toBe('same-origin');
    expect(value(headers, 'Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    );
    expect(value(headers, 'Content-Security-Policy')).toBe(buildContentSecurityPolicy('production'));
  });

  it('does not restrict notifications', () => {
    expect(value(buildSecurityHeaders('production'), 'Permissions-Policy')).not.toContain('notifications');
  });

  it('omits HSTS in development, keeps it without preload in preview', () => {
    expect(value(buildSecurityHeaders('development'), 'Strict-Transport-Security')).toBeUndefined();
    expect(value(buildSecurityHeaders('preview'), 'Strict-Transport-Security')).toContain('max-age=');
    expect(value(buildSecurityHeaders('preview'), 'Strict-Transport-Security')).not.toContain('preload');
  });

  it('has no duplicate header names', () => {
    const keys = buildSecurityHeaders('production').map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('resolveSecurityEnvironment', () => {
  it('maps NODE_ENV and VERCEL_ENV', async () => {
    const { resolveSecurityEnvironment } = await import('./security-headers');
    expect(resolveSecurityEnvironment({ NODE_ENV: 'development' })).toBe('development');
    expect(resolveSecurityEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveSecurityEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe('preview');
    expect(resolveSecurityEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'production' })).toBe('production');
    expect(resolveSecurityEnvironment({ NODE_ENV: 'development', VERCEL_ENV: 'preview' })).toBe('development');
    expect(resolveSecurityEnvironment({})).toBe('production');
  });
});
