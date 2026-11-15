import { describe, expect, it } from 'vitest';
import { buildTrustedOrigins, createSenderValidator, isTrustedUrl } from './sender';

const origins = { devServerUrl: 'http://localhost:5173', appOrigin: 'app://seedora' };

describe('isTrustedUrl', () => {
  it('accepts the dev server origin and the packaged app origin', () => {
    expect(isTrustedUrl('http://localhost:5173/', origins)).toBe(true);
    expect(isTrustedUrl('http://localhost:5173/some?x=1#h', origins)).toBe(true);
    expect(isTrustedUrl('app://seedora/index.html', origins)).toBe(true);
    expect(isTrustedUrl('app://seedora/', origins)).toBe(true);
  });

  it('rejects other origins, files, schemes and garbage', () => {
    expect(isTrustedUrl('http://localhost:5174/', origins)).toBe(false);
    expect(isTrustedUrl('http://localhost.evil.com:5173/', origins)).toBe(false);
    expect(isTrustedUrl('https://example.com/', origins)).toBe(false);
    expect(isTrustedUrl('file:///etc/passwd', origins)).toBe(false);
    expect(isTrustedUrl('file:///app/renderer/main_window/index.html', origins)).toBe(false);
    expect(isTrustedUrl('file://seedora/index.html', origins)).toBe(false);
    expect(isTrustedUrl('app://evil/index.html', origins)).toBe(false);
    expect(isTrustedUrl('app://seedora.evil.com/index.html', origins)).toBe(false);
    expect(isTrustedUrl('app://user@seedora/index.html', origins)).toBe(false);
    expect(isTrustedUrl('app://seedora:81/index.html', origins)).toBe(false);
    expect(isTrustedUrl('http://seedora/index.html', origins)).toBe(false);
    expect(isTrustedUrl('about:blank', origins)).toBe(false);
    expect(isTrustedUrl('not a url', origins)).toBe(false);
  });

  it('does not trust the dev server when none is configured (packaged build)', () => {
    expect(isTrustedUrl('http://localhost:5173/', { appOrigin: origins.appOrigin })).toBe(false);
  });
});

it('never trusts a file: URL, even when configured as an origin', () => {
  expect(isTrustedUrl('file:///x/index.html', { appOrigin: 'file:///x/index.html' })).toBe(false);
  expect(isTrustedUrl('file:///etc/hosts', { devServerUrl: 'file:///' })).toBe(false);
});

describe('isTrustedUrl with unusual paths (packaged-build checklist, 2df)', () => {
  it('trusts the app origin whatever the path holds: spaces, non-ASCII, Windows-style segments, query and hash', () => {
    for (const url of [
      'app://seedora/dir%20with%20spaces/index.html',
      'app://seedora/%C3%A9t%C3%A9/%E6%97%A5%E6%9C%AC.html',
      'app://seedora/C:/Users/me/AppData/index.html',
      'app://seedora/a%5Cb/index.html?x=%20y#frag',
    ]) {
      expect(isTrustedUrl(url, origins), url).toBe(true);
    }
  });

  it('still refuses a file: URL with the same odd paths', () => {
    for (const url of ['file:///C:/Users/me/My%20App/index.html', 'file:///Users/%C3%A9/index.html', 'file:///etc/hosts']) {
      expect(isTrustedUrl(url, origins), url).toBe(false);
    }
  });
});

describe('createSenderValidator', () => {
  const isTrusted = createSenderValidator(origins);
  it('requires a live top-level frame on a trusted URL', () => {
    expect(isTrusted({ senderFrame: { url: 'http://localhost:5173/', parent: null } })).toBe(true);
    expect(isTrusted({ senderFrame: null })).toBe(false);
    expect(isTrusted({ senderFrame: { url: 'http://localhost:5173/', parent: {} } })).toBe(false);
    expect(isTrusted({ senderFrame: { url: 'https://evil.example/', parent: null } })).toBe(false);
  });
});

describe('buildTrustedOrigins', () => {
  it('trusts the dev server in development and the app origin when built', () => {
    expect(buildTrustedOrigins('http://localhost:5173', false, 'app://seedora')).toEqual({ devServerUrl: 'http://localhost:5173', appOrigin: undefined });
    expect(buildTrustedOrigins(undefined, true, 'app://seedora')).toEqual({ devServerUrl: undefined, appOrigin: 'app://seedora' });
    expect(buildTrustedOrigins(undefined, false, 'app://seedora').appOrigin).toBe('app://seedora');
  });

  it('throws when a packaged build carries a dev server URL', () => {
    expect(() => buildTrustedOrigins('http://localhost:5173', true, 'app://seedora')).toThrow();
  });
});
