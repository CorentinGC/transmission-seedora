import { describe, expect, it } from 'vitest';
import { classifyHost, decideRoute } from './hosts';

describe('classifyHost', () => {
  it('maps the apex, www and everything else', () => {
    expect(classifyHost('seedora.app')).toBe('site');
    expect(classifyHost('SEEDORA.app:443')).toBe('site');
    expect(classifyHost('www.seedora.app')).toBe('site-www');
    expect(classifyHost('app.seedora.app')).toBe('app');
    expect(classifyHost('localhost:3000')).toBe('app');
    expect(classifyHost(null)).toBe('app');
  });
});

describe('decideRoute', () => {
  it('leaves the app host alone', () => {
    expect(decideRoute('app.seedora.app', '/')).toEqual({ kind: 'next' });
    expect(decideRoute('localhost:3000', '/landing/en')).toEqual({ kind: 'next' });
  });
  it('redirects www to the apex, keeping the path', () => {
    expect(decideRoute('www.seedora.app', '/fr')).toEqual({ kind: 'redirect', url: 'https://seedora.app/fr' });
  });
  it('rewrites the landing paths on the apex', () => {
    expect(decideRoute('seedora.app', '/')).toEqual({ kind: 'rewrite', pathname: '/landing/en' });
    expect(decideRoute('seedora.app', '/fr')).toEqual({ kind: 'rewrite', pathname: '/landing/fr' });
  });
  it('lets static assets and crawler files through on the apex', () => {
    expect(decideRoute('seedora.app', '/landing/desktop-dark.png')).toEqual({ kind: 'next' });
    expect(decideRoute('seedora.app', '/robots.txt')).toEqual({ kind: 'next' });
    expect(decideRoute('seedora.app', '/sitemap.xml')).toEqual({ kind: 'next' });
  });
  it('sends any other apex path to the app host', () => {
    expect(decideRoute('seedora.app', '/anything')).toEqual({
      kind: 'redirect',
      url: 'https://app.seedora.app/anything',
    });
  });
});
